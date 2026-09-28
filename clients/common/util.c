//
// Created by D Rimron-Soutter on 30/03/2020.
//
#include <arch/zxn.h>
#include <stdbool.h>
#include <stdlib.h>

#include "util.h"

// Frames are counted where the active video line wraps (bit 8 falls back to 0), so the
// time is real at any CPU speed and with interrupts off. The first wrap can come at once.
void wait_frames(uint8_t frames) __z88dk_fastcall {
    bool late = false;

    frames++;
    while(frames) {
        if(ZXN_READ_REG(REG_ACTIVE_VIDEO_LINE_H) & 1) {
            late = true;
        } else if(late) {
            late = false;
            frames--;
        }
    }
}

void looper(uint32_t delay) __z88dk_fastcall {
    for(uint32_t i = delay; i>0;i--) {
        zx_border((uint8_t)i%2);
    }
}