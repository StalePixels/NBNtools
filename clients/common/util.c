//
// Created by D Rimron-Soutter on 30/03/2020.
//
#include <arch/zxn.h>
#include <stdlib.h>

#include "util.h"

void looper() {
    for(uint32_t i = 512; i>0;i--) {
        zx_border((uint8_t)i%7);
    }
}