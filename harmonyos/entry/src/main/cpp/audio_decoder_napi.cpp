#include <napi/native_api.h>
#include <unistd.h>
#include <cstring>
#include <vector>
#include <mutex>
#include <condition_variable>
#include <string>

#include "native_avsource.h"
#include "native_avdemuxer.h"
#include "native_avcodec_audiodecoder.h"
#include "native_avcodec_audiocodec.h"
#include "native_avformat.h"
#include "native_averrors.h"

struct DecodeContext {
    OH_AVSource* source = nullptr;
    OH_AVDemuxer* demuxer = nullptr;
    OH_AVCodec* codec = nullptr;

    uint32_t audioTrackIndex = 0;
    std::string mimeType;
    int32_t sampleRate = 44100;
    int32_t channelCount = 2;

    std::vector<uint8_t> pcmData;
    std::mutex mtx;
    std::condition_variable cv;
    bool finished = false;
    bool hasError = false;
    std::string errorMsg;
};

static void OnCodecError(OH_AVCodec* codec, int32_t errorCode, void* userData)
{
    auto* ctx = static_cast<DecodeContext*>(userData);
    std::lock_guard<std::mutex> lock(ctx->mtx);
    ctx->hasError = true;
    ctx->errorMsg = "codec error code: " + std::to_string(errorCode);
    ctx->finished = true;
    ctx->cv.notify_one();
}

static void OnStreamChanged(OH_AVCodec* codec, OH_AVFormat* format, void* userData)
{
    auto* ctx = static_cast<DecodeContext*>(userData);
    if (format) {
        OH_AVFormat_GetIntValue(format, OH_MD_KEY_AUDIOSAMPLE_RATE, &ctx->sampleRate);
        OH_AVFormat_GetIntValue(format, OH_MD_KEY_AUDIO_CHANNEL_COUNT, &ctx->channelCount);
    }
}

static void OnNeedInputData(OH_AVCodec* codec, uint32_t index, OH_AVMemory* data, void* userData)
{
    auto* ctx = static_cast<DecodeContext*>(userData);

    OH_AVCodecBufferAttr attr = {};
    memset(&attr, 0, sizeof(attr));

    int32_t ret = OH_AVDemuxer_ReadSample(ctx->demuxer, ctx->audioTrackIndex, data, &attr);

    if (ret != 0 || (attr.flags & AVCODEC_BUFFER_FLAGS_EOS)) {
        OH_AVCodecBufferAttr eosAttr;
        memset(&eosAttr, 0, sizeof(eosAttr));
        eosAttr.flags = AVCODEC_BUFFER_FLAGS_EOS;
        OH_AVCodec_QueueInputBuffer(codec, index, &eosAttr);
    } else {
        OH_AVCodec_QueueInputBuffer(codec, index, &attr);
    }
}

static void OnNeedOutputData(OH_AVCodec* codec, uint32_t index, OH_AVMemory* data,
                              OH_AVCodecBufferAttr* attr, void* userData)
{
    auto* ctx = static_cast<DecodeContext*>(userData);

    if (attr && (attr->flags & AVCODEC_BUFFER_FLAGS_EOS)) {
        OH_AVCodec_ReleaseOutputBuffer(codec, index);
        std::lock_guard<std::mutex> lock(ctx->mtx);
        ctx->finished = true;
        ctx->cv.notify_one();
        return;
    }

    if (data && attr && attr->size > 0) {
        uint8_t* addr = static_cast<uint8_t*>(OH_AVMemory_GetAddr(data));
        if (addr) {
            std::lock_guard<std::mutex> lock(ctx->mtx);
            ctx->pcmData.insert(ctx->pcmData.end(), addr, addr + attr->size);
        }
    }

    OH_AVCodec_ReleaseOutputBuffer(codec, index);
}

struct WorkData {
    napi_async_work work = nullptr;
    napi_deferred deferred = nullptr;
    int32_t fd = -1;
    int64_t offset = 0;
    int64_t length = 0;

    int32_t sampleRate = 44100;
    int32_t channelCount = 2;
    std::vector<uint8_t> pcmData;
    bool success = false;
    std::string errorMsg;
};

static void ExecuteDecode(napi_env env, void* data)
{
    auto* wd = static_cast<WorkData*>(data);
    DecodeContext ctx;

    ctx.source = OH_AVSource_CreateWithFD(wd->fd, wd->offset, wd->length);
    if (!ctx.source) {
        wd->errorMsg = "AVSource 创建失败";
        return;
    }

    ctx.demuxer = OH_AVDemuxer_CreateWithSource(ctx.source);
    if (!ctx.demuxer) {
        wd->errorMsg = "AVDemuxer 创建失败";
        OH_AVSource_Destroy(ctx.source);
        return;
    }

    uint32_t trackCount = 0;
    OH_AVDemuxer_GetSourceTrackCount(ctx.demuxer, &trackCount);

    bool foundAudio = false;
    for (uint32_t i = 0; i < trackCount; i++) {
        OH_AVFormat* fmt = OH_AVFormat_Create();
        if (OH_AVDemuxer_CopyTrackFormat(ctx.demuxer, i, fmt)) {
            const char* mime = nullptr;
            if (OH_AVFormat_GetStringValue(fmt, OH_MD_KEY_CODEC_MIME, &mime) && mime) {
                std::string mimeStr(mime);
                if (mimeStr.rfind("audio/", 0) == 0) {
                    ctx.audioTrackIndex = i;
                    ctx.mimeType = mimeStr;
                    OH_AVFormat_GetIntValue(fmt, OH_MD_KEY_AUDIOSAMPLE_RATE, &ctx.sampleRate);
                    OH_AVFormat_GetIntValue(fmt, OH_MD_KEY_AUDIO_CHANNEL_COUNT, &ctx.channelCount);
                    foundAudio = true;
                    OH_AVFormat_Destroy(fmt);
                    break;
                }
            }
        }
        OH_AVFormat_Destroy(fmt);
    }

    if (!foundAudio) {
        wd->errorMsg = "文件中未找到音频轨道";
        OH_AVDemuxer_Destroy(ctx.demuxer);
        OH_AVSource_Destroy(ctx.source);
        return;
    }

    OH_AVDemuxer_SelectTrackByID(ctx.demuxer, ctx.audioTrackIndex);

    ctx.codec = OH_AVCodec_CreateByMime(ctx.mimeType.c_str());
    if (!ctx.codec) {
        wd->errorMsg = "无法创建解码器: " + ctx.mimeType;
        OH_AVDemuxer_Destroy(ctx.demuxer);
        OH_AVSource_Destroy(ctx.source);
        return;
    }

    OH_AVFormat* configFmt = OH_AVFormat_Create();
    OH_AVDemuxer_CopyTrackFormat(ctx.demuxer, ctx.audioTrackIndex, configFmt);
    int32_t ret = OH_AVCodec_Configure(ctx.codec, configFmt);
    OH_AVFormat_Destroy(configFmt);
    if (ret != AV_ERR_OK) {
        wd->errorMsg = "解码器配置失败: " + std::to_string(ret);
        OH_AVCodec_Destroy(ctx.codec);
        OH_AVDemuxer_Destroy(ctx.demuxer);
        OH_AVSource_Destroy(ctx.source);
        return;
    }

    OH_AVCodecAsyncCallback callback;
    callback.onError = OnCodecError;
    callback.onStreamChanged = OnStreamChanged;
    callback.onNeedInputData = OnNeedInputData;
    callback.onNeedOutputData = OnNeedOutputData;

    ret = OH_AVCodec_SetCallback(ctx.codec, callback, &ctx);
    if (ret != AV_ERR_OK) {
        wd->errorMsg = "设置回调失败: " + std::to_string(ret);
        OH_AVCodec_Destroy(ctx.codec);
        OH_AVDemuxer_Destroy(ctx.demuxer);
        OH_AVSource_Destroy(ctx.source);
        return;
    }

    ret = OH_AVCodec_Prepare(ctx.codec);
    if (ret != AV_ERR_OK) {
        wd->errorMsg = "Prepare 失败: " + std::to_string(ret);
        OH_AVCodec_Destroy(ctx.codec);
        OH_AVDemuxer_Destroy(ctx.demuxer);
        OH_AVSource_Destroy(ctx.source);
        return;
    }

    ret = OH_AVCodec_Start(ctx.codec);
    if (ret != AV_ERR_OK) {
        wd->errorMsg = "Start 失败: " + std::to_string(ret);
        OH_AVCodec_Destroy(ctx.codec);
        OH_AVDemuxer_Destroy(ctx.demuxer);
        OH_AVSource_Destroy(ctx.source);
        return;
    }

    {
        std::unique_lock<std::mutex> lock(ctx.mtx);
        ctx.cv.wait(lock, [&ctx] { return ctx.finished; });
    }

    OH_AVCodec_Stop(ctx.codec);
    OH_AVCodec_Destroy(ctx.codec);
    OH_AVDemuxer_Destroy(ctx.demuxer);
    OH_AVSource_Destroy(ctx.source);

    if (ctx.hasError) {
        wd->errorMsg = ctx.errorMsg;
    } else {
        wd->success = true;
        wd->sampleRate = ctx.sampleRate;
        wd->channelCount = ctx.channelCount;
        wd->pcmData = std::move(ctx.pcmData);
    }
}

static void CompleteDecode(napi_env env, napi_status status, void* data)
{
    auto* wd = static_cast<WorkData*>(data);

    if (wd->success && !wd->pcmData.empty()) {
        napi_value resultObj;
        napi_create_object(env, &resultObj);

        napi_value sampleRateVal;
        napi_create_int32(env, wd->sampleRate, &sampleRateVal);
        napi_set_named_property(env, resultObj, "sampleRate", sampleRateVal);

        napi_value channelsVal;
        napi_create_int32(env, wd->channelCount, &channelsVal);
        napi_set_named_property(env, resultObj, "channels", channelsVal);

        size_t totalBytes = wd->pcmData.size();
        napi_value pcmBuffer;
        void* outData = nullptr;
        napi_create_arraybuffer(env, totalBytes, &outData, &pcmBuffer);
        if (totalBytes > 0) {
            memcpy(outData, wd->pcmData.data(), totalBytes);
        }
        napi_set_named_property(env, resultObj, "pcmData", pcmBuffer);

        size_t numFrames = totalBytes / (2 * wd->channelCount);
        napi_value durationVal;
        napi_create_double(env, static_cast<double>(numFrames) / wd->sampleRate, &durationVal);
        napi_set_named_property(env, resultObj, "duration", durationVal);

        napi_resolve_deferred(env, wd->deferred, resultObj);
    } else {
        napi_value err;
        std::string msg = wd->errorMsg.empty() ? "解码失败" : wd->errorMsg;
        napi_create_string_utf8(env, msg.c_str(), NAPI_AUTO_LENGTH, &err);
        napi_reject_deferred(env, wd->deferred, err);
    }

    napi_delete_async_work(env, wd->work);
    delete wd;
}

static napi_value DecodeAudio(napi_env env, napi_callback_info info)
{
    size_t argc = 3;
    napi_value args[3];
    napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);

    auto* wd = new WorkData();
    napi_get_value_int32(env, args[0], &wd->fd);
    napi_get_value_int64(env, args[1], &wd->offset);
    napi_get_value_int64(env, args[2], &wd->length);

    napi_value promise;
    napi_create_promise(env, &wd->deferred, &promise);

    napi_value resourceName;
    napi_create_string_utf8(env, "DecodeAudioWork", NAPI_AUTO_LENGTH, &resourceName);
    napi_create_async_work(env, nullptr, resourceName, ExecuteDecode, CompleteDecode,
                           wd, &wd->work);
    napi_queue_async_work(env, wd->work);

    return promise;
}

EXTERN_C_START
static napi_value Init(napi_env env, napi_value exports)
{
    napi_property_descriptor desc[] = {
        {"decodeAudio", nullptr, DecodeAudio, nullptr, nullptr, nullptr, napi_default, nullptr},
    };
    napi_define_properties(env, exports, sizeof(desc) / sizeof(desc[0]), desc);
    return exports;
}
EXTERN_C_END

static napi_module audioDecoderModule = {
    .nm_version = 1,
    .nm_flags = 0,
    .nm_filename = nullptr,
    .nm_register_func = Init,
    .nm_modname = "audio_decoder",
    .nm_priv = nullptr,
    .reserved = {0},
};

extern "C" __attribute__((constructor)) void RegisterAudioDecoderModule(void)
{
    napi_module_register(&audioDecoderModule);
}
