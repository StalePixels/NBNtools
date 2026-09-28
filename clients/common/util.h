//
// Created by D Rimron-Soutter on 30/03/2020.
//

#include <stdlib.h>

#ifndef NBNTOOLS_UTIL_H
#define NBNTOOLS_UTIL_H

#include "platform.h"

void looper(uint32_t delay) __z88dk_fastcall;
void wait_frames(uint8_t frames) __z88dk_fastcall;

#endif //NBNTOOLS_UTIL_H
