//
// Created by D Rimron-Soutter on 01/04/2020.
//

#include "net.h"
#include "util.h"
#include "uart.h"
#include "messages.h"
#include <string.h>

int NET_Command(char command[], uint8_t len) {
    uint8_t command_letter = 0;

    UART_Send("AT+CIP", 6);
    UART_Send(command, len);
    UART_Send("\x0D\x0A", 2);

    return UART_WaitOK(false);
}

//int NET_Send(char command[], uint8_t len) {
//    UART_Send(command, len);
//}

void NET_Close() {
    UART_Send("+++", 3);
    looper(512);

    NET_Command("MODE=0", 6);
    NET_Command("CLOSE", 5);
    looper(512);
}

uint8_t NET_GetOK(bool localecho) {
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