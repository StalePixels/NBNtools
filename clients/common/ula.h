//
// Created by D Rimron-Soutter on 29/11/2020.
//

#ifndef NBNTOOLS_ULA_H
#define NBNTOOLS_ULA_H

#define printInk(k)                 printf("\x10%c", '0'+k)
#define INK_BLACK_ATTR              "\x10\x00"
#define INK_BLUE_ATTR               "\x10\x01"
#define INK_RED_ATTR                "\x10\x02"
#define INK_MAGENTA_ATTR            "\x10\x03"
#define INK_GREEN_ATTR              "\x10\x04"
#define INK_CYAN_ATTR               "\x10\x05"
#define INK_YELLOW_ATTR             "\x10\x06"
#define INK_WHITE_ATTR              "\x10\x07"
#define PAPER_BLACK_ATTR            "\x11\x00"
#define PAPER_BLUE_ATTR             "\x11\x01"
#define PAPER_RED_ATTR              "\x11\x02"
#define PAPER_MAGENTA_ATTR          "\x11\x03"
#define PAPER_GREEN_ATTR            "\x11\x04"
#define PAPER_CYAN_ATTR             "\x11\x05"
#define PAPER_YELLOW_ATTR           "\x11\x06"
#define PAPER_WHITE_ATTR            "\x11\x07"
#define printPaper(k)               printf("\x11%c", '0'+k)
#define STRING_PAPER(k)             "\x11%c", '0'+k
#define printFlash(k)               printf("\x12%c",30+k)
#define printFlashOn()              printf("\x12\x31")
#define printFlashOff()             printf("\x12\x30")
#define printBright(k)              printf("\x13%d", k)
#define printBrightOn()             printf("\x13""1")
#define printBrightOff()            printf("\x13""0")
#define printAt(row, col)           printf("\x16%c%c", col, row)
#define printAtStr(row, col, ...)   printf("\x16%c%c%s", col, row, __VA_ARGS__)

#define plot(x, y)                  (*zx_pxy2saddr(x,y) |= zx_px2bitmask(x));
#endif //NBNTOOLS_ULA_H
