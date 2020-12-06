cmake_minimum_required(VERSION 3.10)
project(nbnshell C)


include_directories(
        /u/ZX/z88dk/include/_DEVELOPMENT/sccz80
)

add_executable(nbnshell
# Main App
	nbnshell.c

# Common Library Code
	../common/nbn.c
	../common/net.c
	../common/uart.c
	../common/util.c
    ../common/ula.h
	../common/spui_lite.c
		)
