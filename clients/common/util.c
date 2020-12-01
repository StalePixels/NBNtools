//
// Created by D Rimron-Soutter on 30/03/2020.
//
#include <arch/zxn.h>
#include <stdlib.h>

#include "util.h"

void looper(uint32_t delay) __z88dk_fastcall {
    for(uint32_t i = delay; i>0;i--) {
        zx_border((uint8_t)i%2);
    }
}