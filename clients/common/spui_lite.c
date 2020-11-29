//
// Created by D Rimron-Soutter on 29/11/2020.
//

#include <arch/zxn.h>
#include "spui_lite.h"

#define SPUI_LINE_LEFT 128
#define SPUI_LINE_LEFT_BOTTOM 129
#define SPUI_LINE_RIGHT  1
#define SPUI_LINE_RIGHT_BOTTOM  2

void SPUI_triangle(uint8_t row, uint8_t col, uint8_t attr) {
    uint8_t y = row-1;
    uint8_t x = col-1;
    uint8_t *addr;
    *zx_cxy2aaddr(x, y) = attr;
    addr = zx_cxy2saddr(x, y);
    *addr = 1;
    addr = addr + 256;
    *addr = 3;
    addr = addr + 256;
    *addr = 7;
    addr = addr + 256;
    *addr = 15;
    addr = addr + 256;
    *addr = 31;
    addr = addr + 256;
    *addr = 63;
    addr = addr + 256;
    *addr = 127;
    addr = addr + 256;
    *addr = 255;
}

void SPUI_line(uint8_t row, uint8_t col, uint8_t spui_line) {
    uint8_t bottom = spui_line;
    uint8_t *addr = zx_cxy2saddr(col-1, row-1);

    if(spui_line==SPUI_LINE_RIGHT_BOTTOM || spui_line==SPUI_LINE_LEFT_BOTTOM) {
        bottom = 255;
        --spui_line;
    }
    *addr = spui_line;
    addr = addr + 256;
    *addr = spui_line;
    addr = addr + 256;
    *addr = spui_line;
    addr = addr + 256;
    *addr = spui_line;
    addr = addr + 256;
    *addr = spui_line;
    addr = addr + 256;
    *addr = spui_line;
    addr = addr + 256;
    *addr = spui_line;
    addr = addr + 256;
    *addr = bottom;
}