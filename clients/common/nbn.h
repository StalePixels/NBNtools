//
// Created by D Rimron-Soutter on 31/03/2020.
//

#ifndef NBNTOOLS_NBN_H
#define NBNTOOLS_NBN_H

#define NBN_blocksize 240

#include <stdlib.h>

unsigned char NBN_GetStatus();
void NBN_GetBlock(unsigned char[] block);
void NBN_SendBlock(unsigned char[] block, uint8_t length);

#endif //NBNTOOLS_NBN_H
