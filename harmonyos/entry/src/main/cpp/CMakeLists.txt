cmake_minimum_required(VERSION 3.5.0)
project(audio_decoder)

set(CMAKE_CXX_STANDARD 17)

include_directories(${CMAKE_CURRENT_SOURCE_DIR})

# Add multimedia player framework headers from HarmonyOS SDK
if(DEFINED ENV{OHOS_SDK_HOME})
    include_directories($ENV{OHOS_SDK_HOME}/openharmony/native/sysroot/usr/include/multimedia/player_framework)
elseif(DEFINED ENV{DEVECO_SDK_HOME})
    include_directories($ENV{DEVECO_SDK_HOME}/command-line-tools/sdk/default/openharmony/native/sysroot/usr/include/multimedia/player_framework)
endif()

add_library(audio_decoder SHARED
    audio_decoder_napi.cpp
)

target_link_libraries(audio_decoder PUBLIC
    libace_napi.z.so
    libnative_media_codecbase.so
    libnative_media_avcodec.so
    libnative_media_avdemuxer.so
    libnative_media_avsource.so
)
