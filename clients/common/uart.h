//
// Created by D Rimron-Soutter on 30/03/2020.
//

#include <stdlib.h>
#include <stdbool.h>

#ifndef NBNTOOLS_UART_H
#define NBNTOOLS_UART_H

extern uint8_t verbose;

unsigned char Net_GetUChar();
void Net_Send(char command[], uint8_t len);
uint8_t Net_WaitOK(bool localecho);
int Net_Command(char command[], uint8_t len);
void Net_Close();

#endif //NBNTOOLS_UART_H
