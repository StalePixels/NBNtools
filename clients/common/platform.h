//
// Build switch. zcc +zxn defines __ZXNEXT, and that selects the Next code.
// Any other compiler builds for a POSIX host (macOS first).
//

#ifndef NBNTOOLS_PLATFORM_H
#define NBNTOOLS_PLATFORM_H

#ifndef __ZXNEXT
#include <fcntl.h>
#include <stdbool.h>
#include <stdint.h>
#include <strings.h>

#define __z88dk_fastcall
#define stricmp                 strcasecmp
#define zx_border(colour)

// esxdos file calls, on top of the POSIX file calls (common/posix.c)
#define ESXDOS_MODE_R           O_RDONLY
#define ESXDOS_MODE_W           O_WRONLY
#define ESXDOS_MODE_CT          (O_CREAT | O_TRUNC)

uint8_t esxdos_f_open(const char *filename, int mode);
int esxdos_f_read(uint8_t handle, void *dst, size_t nbytes);
uint16_t esxdos_f_write(uint8_t handle, void *src, uint16_t len);
void esxdos_f_close(uint8_t handle);
int esxdos_f_unlink(void *filename);
uint8_t esx_f_rename(const char *old, const char *new);
#endif

#endif //NBNTOOLS_PLATFORM_H
