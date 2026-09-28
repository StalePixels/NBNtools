//
// Created by D Rimron-Soutter on 01/04/2020.
//

#include "net.h"
#include "util.h"
#include "uart.h"
#include "messages.h"
#include <string.h>

int NET_Command(char command[], uint8_t len) __z88dk_fastcall {
    uint8_t command_letter = 0;

    UART_Send("AT+CIP", 6);
    UART_Send(command, len);
    UART_Send("\x0D\x0A", 2);

    return UART_WaitOK(false);
}

// A frame is 20 ms at 50 Hz and 16.7 ms at 60 Hz: 4 frames are at least 60 ms, 60 frames at
// least 1 s. The ESP8266 sees "+++" only as a packet of its own, with quiet time on both sides.
// A caller that has sent nothing for 60 ms already can pass delay = false
#define GUARD_BEFORE    4
#define GUARD_AFTER     60

void NET_Close(bool delay) __z88dk_fastcall {
    if(delay) wait_frames(GUARD_BEFORE);
    UART_Send("+++", 3);
    wait_frames(GUARD_AFTER);
    UART_Drain();

    NET_Command("MODE=0", 6);
    NET_Command("CLOSE", 5);
    looper(512);
}

uint8_t NET_GetOK(bool localecho) __z88dk_fastcall {
    uint8_t command_letter = 0;

    UART_Send("AT\x0D\x0A", 4);

    return UART_WaitOK(localecho);
}

void NET_Connect(char* server, char* port) {
    NET_Send("AT+CIPSTART=\"TCP\",\"", 19);
    NET_Send(server, strlen(server));
    NET_Send("\",", 2);
    NET_Send(port, strlen(port));
    NET_Send("\x0D\x0A", 2);
}

void NET_ModeSingle() {
    if(NET_Command("MODE=1", 6)) {
        exit((int)err_at_protocol);
    };
}

void NET_ModeMulti() {
    if(NET_Command("MODE=0", 6)) {
        exit((int)err_at_protocol);
    };
}

void NET_OpenSocket() {
    if(NET_Command("SEND", 4)) {
        exit((int)err_at_protocol);
    };
}