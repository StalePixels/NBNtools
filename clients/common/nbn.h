//
// Created by D Rimron-Soutter on 31/03/2020.
//

#ifndef NBNTOOLS_NBN_H
#define NBNTOOLS_NBN_H

#define NBN_blocksize 240

#include <stdlib.h>

void NBN_GetBlock(char[] block);
void NBN_SendBlock(char[] block);

#endif //NBNTOOLS_NBN_H
