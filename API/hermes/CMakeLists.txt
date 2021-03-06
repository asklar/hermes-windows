# Copyright (c) Facebook, Inc. and its affiliates.
#
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.

set(HERMES_OPTIONAL_SOURCES
  hermes.cpp
  hermes_tracing.cpp
  hermes_tracing_compat.cpp
  DebuggerAPI.cpp
  SynthTrace.cpp
  SynthTraceParser.cpp
  TraceInterpreter.cpp
  TracingRuntime.cpp
  CompileJS.cpp
  )

set(api_sources
  hermes.cpp
  DebuggerAPI.cpp
  )

file(GLOB api_headers ${CMAKE_CURRENT_SOURCE_DIR}/*.h)
file(GLOB api_public_headers ${PROJECT_SOURCE_DIR}/public/hermes/Public/*.h)

if (HERMESVM_API_TRACE)
  list(APPEND api_sources
    hermes_tracing.cpp
    SynthTrace.cpp
    SynthTraceParser.cpp
    TraceInterpreter.cpp
    TracingRuntime.cpp
    )
else()
  list(APPEND api_sources hermes_tracing_compat.cpp)
endif()

add_hermes_library(hermesapi
        ${api_sources}
        LINK_LIBS jsi hermesVMRuntime)

set(hermesapi_compile_flags "")
if ("${CMAKE_CXX_COMPILER_ID}" MATCHES "Clang" OR
    "${CMAKE_CXX_COMPILER_ID}" MATCHES "GNU")
  string(APPEND hermesapi_compile_flags " -Wno-non-virtual-dtor")
endif()

set_property(TARGET hermesapi PROPERTY
  CXX_STANDARD 14)
set_property(TARGET hermesapi APPEND_STRING PROPERTY
  COMPILE_FLAGS ${hermesapi_compile_flags})
set_property(TARGET hermesapi APPEND_STRING PROPERTY
  COMPILE_DEFINITIONS "CREATE_SHARED_LIBRARY")

set(HERMES_LINK_COMPONENTS LLVHSupport)

# Disable EH and RTTI for compileJS
set(HERMES_ENABLE_EH OFF)
set(HERMES_ENABLE_RTTI OFF)

add_hermes_library(compileJS STATIC CompileJS.cpp)

# Restore EH and RTTI (Note: At the time of writing, there is no usage of
# add_hermes_library either after this line in this file or in a sub directory.
# However, the values are restored anyways for the sake of sanity.)
set(HERMES_ENABLE_EH ON)
set(HERMES_ENABLE_RTTI ON)

add_library(libhermes SHARED ${api_sources} ${api_headers} ${api_public_headers})
target_link_libraries(libhermes
  jsi
  hermesVMRuntime
  ${CORE_FOUNDATION}
)
hermes_link_icu(libhermes)

# Export the required header directory
target_include_directories(libhermes PUBLIC ..)

if("${CMAKE_CXX_COMPILER_ID}" MATCHES "Clang" OR
    "${CMAKE_CXX_COMPILER_ID}" MATCHES "GNU")
  # Export all API symbols
  set(compile_flags "-fvisibility=default")
  # The linker doesn't support -flto -Os, so make sure it's linked with -O3.
  # This only affects linking, not compilation, so without -flto it's a no-op.
  # In other words, if the compiler flags are -O0 -fno-lto, then the resulting
  # library will be -O0 in spite of setting -O3 here.
  set(link_flags "-O3 ${OPTIONAL_GC_SECTIONS} ${OPTIONAL_JNI_ONLOAD}")
elseif("${CMAKE_CXX_COMPILER_ID}" MATCHES "MSVC")
  # Same as above, but for windows. Note that there is no equivalent of -fvisibility=default.
  set(compile_flags "")
  set(link_flags "/O2 ${OPTIONAL_GC_SECTIONS} ${OPTIONAL_JNI_ONLOAD}")

  # Generate a PDB for debug builds
  if("{CMAKE_BUILD_TYPE}" MATCHES "Debug")
    set(compile_flags "${compile_flags} /Zi")
    set(link_flags "${link_flags} /DEBUG")
  endif()

endif()

set_target_properties(libhermes PROPERTIES
  COMPILE_FLAGS "${compile_flags}"
  LINK_FLAGS "${link_flags}"
  # Declare our dependency on std::make_unique
  CXX_STANDARD 14
  CXX_STANDARD_REQUIRED 14
  # Avoid becoming liblibhermes (and there's already a target called 'hermes')
  OUTPUT_NAME hermes
)

set_property(TARGET libhermes APPEND_STRING PROPERTY
  COMPILE_DEFINITIONS "CREATE_SHARED_LIBRARY")

if(APPLE AND HERMES_BUILD_APPLE_FRAMEWORK)
  set_target_properties(libhermes PROPERTIES
    FRAMEWORK TRUE
    VERSION ${PROJECT_VERSION}
    SOVERSION ${PROJECT_VERSION}
    FRAMEWORK_VERSION ${PROJECT_VERSION_MAJOR}
    MACOSX_FRAMEWORK_SHORT_VERSION_STRING ${PROJECT_VERSION}
    MACOSX_FRAMEWORK_BUNDLE_VERSION ${PROJECT_VERSION}
    MACOSX_FRAMEWORK_IDENTIFIER dev.hermesengine.${CMAKE_SYSTEM_NAME}
  )
  # Install headers into `Headers` while keeping required directory structure
  set_source_files_properties(${api_headers} PROPERTIES
    MACOSX_PACKAGE_LOCATION Headers
  )
  set_source_files_properties(${api_public_headers} PROPERTIES
    MACOSX_PACKAGE_LOCATION Headers/Public
  )
endif()

install(TARGETS libhermes
  RUNTIME DESTINATION bin
  LIBRARY DESTINATION lib
  ARCHIVE DESTINATION lib
  FRAMEWORK DESTINATION Library/Frameworks
)
# Install headers into `include` while keeping required directory structure
install(DIRECTORY "${PROJECT_SOURCE_DIR}/API/hermes" DESTINATION include
  FILES_MATCHING PATTERN "*.h"
  PATTERN "synthtest" EXCLUDE)

# Create debug symbols (dSYM) bundle for Apple platform dylibs/frameworks
# Largely inspired by https://github.com/llvm/llvm-project/blob/6701993027f8af172d7ba697884459261b00e3c6/llvm/cmake/modules/AddLLVM.cmake#L1934-L1986
if(HERMES_BUILD_APPLE_DSYM)
  if(CMAKE_CXX_FLAGS MATCHES "-flto")
    set(lto_object ${CMAKE_CURRENT_BINARY_DIR}/${CMAKE_CFG_INTDIR}/libhermes-lto.o)
    set_property(TARGET libhermes APPEND_STRING PROPERTY LINK_FLAGS " -Wl,-object_path_lto,${lto_object}")
  endif()

  get_target_property(DSYM_PATH libhermes LOCATION)
  if(HERMES_BUILD_APPLE_FRAMEWORK)
    get_filename_component(DSYM_PATH ${DSYM_PATH} DIRECTORY)
  endif()
  set(DSYM_PATH "${DSYM_PATH}.dSYM")

  if(NOT CMAKE_DSYMUTIL)
    set(CMAKE_DSYMUTIL xcrun dsymutil)
  endif()
  add_custom_command(TARGET libhermes POST_BUILD
    COMMAND ${CMAKE_DSYMUTIL} $<TARGET_FILE:libhermes> --out ${DSYM_PATH}
    BYPRODUCTS ${DSYM_PATH}
  )

  if(HERMES_BUILD_APPLE_FRAMEWORK)
    install(DIRECTORY ${DSYM_PATH} DESTINATION Library/Frameworks)
  else()
    install(DIRECTORY ${DSYM_PATH} DESTINATION lib)
  endif()
endif()
