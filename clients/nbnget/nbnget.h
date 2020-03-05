#ifndef _NBNGET_H
#define _NBNGET_H

#include <stdlib.h>

void looper();
unsigned char Net_GetUChar();
void Net_Send(char command[], uint8_t len);
uint8_t Net_WaitOK(bool localecho);
int Net_Command(char command[], uint8_t len);
void Net_Close();
static void shutdown();

void NBN_GetBlock(uint8_t blockSize);

#endif