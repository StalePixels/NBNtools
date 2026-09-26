//
// TCP transport for NBN_POSIX builds. It replaces uart.c and net.c: the
// UART_ and NET_ calls use a socket, not ESP8266 AT commands.
//
// Writes are held in a buffer and sent in one write() just before the next
// read. The server reads each TCP chunk as one command or ack, and on the
// Next the ESP8266 groups the bytes the same way (for example, "!\r\n" and
// "!1\r\n" after a block arrive as one chunk).
//

#include <netdb.h>
#include <poll.h>
#include <stdio.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>

#include "uart.h"
#include "net.h"
#include "messages.h"

#define NET_TIMEOUT_MS          10000

static int netSocket = -1;
static bool uartVerbose = false;

static unsigned char netOut[512];
static size_t netOutLength = 0;

static unsigned char netIn[4096];
static ssize_t netInLength = 0, netInPosition = 0;

static void net_flush(void) {
    size_t done = 0;

    while (done < netOutLength) {
        ssize_t written = write(netSocket, netOut + done, netOutLength - done);
        if (written < 0) {
            // NET_Close runs at exit and flushes again
            netOutLength = 0;
            NBN_Fail(err_failed_connection);
        }
        done += written;
    }
    netOutLength = 0;
}

// Returns -1 on timeout, or when the server closes the connection
static int net_read_byte(void) {
    if (netSocket < 0) return -1;

    if (netInPosition == netInLength) {
        net_flush();

        struct pollfd ready = { netSocket, POLLIN, 0 };
        if (poll(&ready, 1, NET_TIMEOUT_MS) != 1) return -1;

        netInLength = read(netSocket, netIn, sizeof netIn);
        netInPosition = 0;
        if (netInLength <= 0) {
            netInLength = 0;
            return -1;
        }
    }
    return netIn[netInPosition++];
}

void UART_SetVerbose(bool status) {
    uartVerbose = status;
}

unsigned char UART_GetUChar() {
    int c = net_read_byte();

    if (c < 0) NBN_Fail(err_timeout_byte);
    return c;
}

void UART_GetUInt16(uint8_t* val) {
    *val = UART_GetUChar();
    *(++val) = UART_GetUChar();
}

void UART_GetUInt32(uint8_t* val) {
    *val = UART_GetUChar();
    *(++val) = UART_GetUChar();
    *(++val) = UART_GetUChar();
    *(++val) = UART_GetUChar();
}

void UART_Send(char command[], uint8_t len) {
    uint8_t command_letter = 0;

    for(;len!=0;len--) {
        UART_PutCh(command[command_letter++]);
    }
}

void UART_PutCh(char c) {
    if (uartVerbose) fputc(c, stderr);
    if (netOutLength == sizeof netOut) net_flush();
    netOut[netOutLength++] = c;
}

// The server sends no "OK". After an error byte it sends the rest of the
// error line, then closes. Returns 0 at the end of the line, 254 if the
// connection ends first.
uint8_t UART_WaitOK(bool localecho) {
    int c;

    while ((c = net_read_byte()) >= 0) {
        if (localecho) putchar(c);
        if (c == 10) return 0;
    }
    return 254;
}

void NET_Connect(char* server, char* port) {
    struct addrinfo hints, *found, *each;

    memset(&hints, 0, sizeof hints);
    hints.ai_socktype = SOCK_STREAM;
    if (getaddrinfo(server, port, &hints, &found)) NBN_Fail(err_bad_server);

    for (each = found; each; each = each->ai_next) {
        netSocket = socket(each->ai_family, each->ai_socktype, each->ai_protocol);
        if (netSocket < 0) continue;
        if (connect(netSocket, each->ai_addr, each->ai_addrlen) == 0) break;
        close(netSocket);
        netSocket = -1;
    }
    freeaddrinfo(found);

    if (netSocket < 0) NBN_Fail(err_failed_connection);
}

void NET_Close() {
    if (netSocket < 0) return;

    net_flush();
    close(netSocket);
    netSocket = -1;
}
