//
// Host support for POSIX host builds: error exits and the esxdos file calls.
//

#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

#include "platform.h"
#include "messages.h"

void NBN_Fail(const unsigned char *message) {
    fflush(stdout);
    fprintf(stderr, "%s\n", message);
    exit(1);
}

uint8_t esxdos_f_open(const char *filename, int mode) {
    return (uint8_t)open(filename, mode, 0644);
}

uint16_t esxdos_f_write(uint8_t handle, void *src, uint16_t len) {
    uint16_t done = 0;

    while (done < len) {
        ssize_t written = write(handle, (uint8_t *)src + done, len - done);
        if (written < 0) break;
        done += written;
    }
    return done;
}

void esxdos_f_close(uint8_t handle) {
    // 0 is the "no file open" value in the clients, and on a host it is stdin
    if (handle) close(handle);
}
