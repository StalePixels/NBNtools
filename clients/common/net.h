//
// Created by D Rimron-Soutter on 01/04/2020.
//

#ifndef NBNTOOLS_NET_H
#include "stdlib.h"
#include "stdbool.h"
#include "uart.h"

#define NBNTOOLS_NET_H


#define NET_Send                        UART_Send
#define NET_GetUChar                    UART_GetUChar
#define NET_PutCh                       UART_PutCh

int NET_Command(char command[], uint8_t len);
//int NET_Send(char command[], uint8_t len);
void NET_Close();
uint8_t NET_GetOK(bool localecho);
void NET_Connect(char* server, char* port);
void NET_ModeSingle();
void NET_ModeMulti();
void NET_OpenSocket();


#endif //NBNTOOLS_NET_H
