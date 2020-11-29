//
// Created by D Rimron-Soutter on 29/11/2020.
//

#ifndef SPUI_LITE_H
#define SPUI_LITE_H

#include <stdint.h>

#define SPUI_LINE_LEFT 128
#define SPUI_LINE_LEFT_BOTTOM 129
#define SPUI_LINE_RIGHT  1
#define SPUI_LINE_RIGHT_BOTTOM  2

void SPUI_triangle(uint8_t row, uint8_t col, uint8_t attr);
void SPUI_line(uint8_t row, uint8_t col, uint8_t spui_line);

#endif //SPUI_LITE_H
