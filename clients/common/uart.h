//
// Created by D Rimron-Soutter on 30/03/2020.
//

#include <stdlib.h>
#include <stdbool.h>

#ifndef NBNTOOLS_UART_H
#define NBNTOOLS_UART_H

__sfr __banked __at 0x153b IO_153B;
__sfr __banked __at 0x153b IO_UART_CONTROL;

unsigned char UART_GetUChar();

void UART_SetVerbose(bool status);
void UART_Send(char command[], uint8_t len);
void UART_PutCh(char c);
uint8_t UART_WaitOK(bool localecho);
uint8_t UART_GetStatus(bool localecho);
int Net_Command(char command[], uint8_t len);
void UART_Close();


#endif //NBNTOOLS_UART_H
