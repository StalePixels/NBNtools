//
// Host support for POSIX host builds: error exits and the esxdos file calls.
//

#include <errno.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/stat.h>
#include <unistd.h>

#include "platform.h"
#include "messages.h"

void NBN_Fail(const unsigned char *message) {
    fflush(stdout);
    fprintf(stderr, "%s\n", message);
    exit(1);
}

// $HOME/.nbn stands in for the Next's SD card
static const char *card_dirs[] = { "", "/sys" };

__attribute__((constructor)) static void card_setup(void) {
    const char *home = getenv("HOME");
    int error = errno;
    char buf[PATH_MAX];
    unsigned int i;

    if (!home || !*home) return;
    for (i = 0; i < sizeof card_dirs / sizeof card_dirs[0]; i++) {
        if (snprintf(buf, PATH_MAX, "%s/.nbn%s", home, card_dirs[i]) >= PATH_MAX) break;
        mkdir(buf, 0755);
    }
    errno = error;
}

static const char *sd_path(char *buf, const char *path) {
    const char *home = getenv("HOME");

    if (path[0] != '/') return path;
    if (!home || !*home) {
        errno = ENOENT;
        return NULL;
    }
    if (snprintf(buf, PATH_MAX, "%s/.nbn%s", home, path) >= PATH_MAX) {
        errno = ENAMETOOLONG;
        return NULL;
    }
    return buf;
}

uint8_t esxdos_f_open(const char *filename, int mode) {
    char buf[PATH_MAX];

    if (!(filename = sd_path(buf, filename))) return 0xFF;
    return (uint8_t)open(filename, mode, 0644);
}

int esxdos_f_read(uint8_t handle, void *dst, size_t nbytes) {
    size_t done = 0;

    while (done < nbytes) {
        ssize_t got = read(handle, (uint8_t *)dst + done, nbytes - done);
        if (got <= 0) break;
        done += got;
    }
    return done;
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

int esxdos_f_unlink(void *filename) {
    char buf[PATH_MAX];
    const char *path = sd_path(buf, filename);

    if (!path) return -1;
    return unlink(path);
}

// esxdos will not rename onto an existing file; POSIX rename() would replace it
uint8_t esx_f_rename(const char *old, const char *new) {
    char oldbuf[PATH_MAX], newbuf[PATH_MAX];
    int error = errno;

    if (!(old = sd_path(oldbuf, old)) || !(new = sd_path(newbuf, new))) return 0xFF;
    if (access(new, F_OK) == 0) {
        errno = EEXIST;
        return 0xFF;
    }
    errno = error;
    return rename(old, new) ? 0xFF : 0;
}
