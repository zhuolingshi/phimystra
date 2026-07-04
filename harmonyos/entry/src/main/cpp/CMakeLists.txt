cmake_minimum_required(VERSION 3.5.0)
project(audio_decoder)

set(CMAKE_CXX_STANDARD 17)

include_directories(${CMAKE_CURRENT_SOURCE_DIR})

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
