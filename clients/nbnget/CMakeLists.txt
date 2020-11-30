cmake_minimum_required(VERSION 3.10)
project(nbnget C)


include_directories(
        /u/ZX/z88dk/include/_DEVELOPMENT/sccz80
)

add_executable(nbnget
# Main App
	nbnget.c 

# Common Library Code
	../common/nbn.c
	../common/net.c
	../common/uart.c
	../common/util.c
        ../common/ula.h ../common/spui_lite.c ../common/spui_lite.h)
