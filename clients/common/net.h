//
// Created by D Rimron-Soutter on 01/04/2020.
//

#ifndef NBNTOOLS_NET_H
#include "stdlib.h"
#include "stdbool.h"
#include "uart.h"

#define NBNTOOLS_NET_H

#define NET_GetUChar                    UART_GetUChar
#define NET_GetUInt8                    UART_GetUChar
#define NET_GetUInt16                   UART_GetUInt16
#define NET_GetUInt32                   UART_GetUInt32

#define NET_Send                        UART_Send
#define NET_PutCh                       UART_PutCh
#define NET_WaitOK                      UART_WaitOK

int NET_Command(char command[], uint8_t len) __z88dk_fastcall;
//int NET_Send(char command[], uint8_t len);
void NET_Close();
uint8_t NET_GetOK(bool localecho) __z88dk_fastcall;
void NET_Connect(char* server, char* port);
void NET_ModeSingle();
void NET_ModeMulti();
void NET_OpenSocket();


#endif //NBNTOOLS_NET_H
