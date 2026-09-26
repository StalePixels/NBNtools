NAME ?= nbnget
BUILD_DIR ?= ./BUILD-$(NAME)
TMP_DIR ?= ./TMP-$(NAME)
SRC_DIRS ?= ./src
DOCS_DIR ?= ./docs
FILES_DIR ?= ./dist
RELEASE_DIR ?= ./RELEASE-$(NAME)
PUBLIC_DIR ?= $(RELEASE_DIR)/PUBLIC/$(NAME)
PLUGIN_DIR ?= ./plugins
DEV_DIR ?= $(RELEASE_DIR)/DEV
GITHUB_DIR ?= $(RELEASE_DIR)/GITHUB
INSTALL_DRIVE ?= /Volumes/devnext

LIBSPRITE := ./zxnext_sprite
LIBSPRITE_INCLUDE := $(LIBSPRITE)/include
LIBSPRITE_LIB := $(LIBSPRITE)/lib/sccz80

LIBLAYER2 := ./zxnext_layer2
LIBLAYER2_INCLUDE := $(LIBLAYER2)/include
LIBLAYER2_LIB := $(LIBLAYER2)/lib/sccz80

DEBUGFLAGS := --list --c-code-in-asm

CRT := 1

CC=zcc
CCFLAGS=+zxn -vn -O3 -startup=$(CRT) -clib=new
LDFLAGS=-m -lm
INCFLAGS=

SH := /bin/sh
CD := cd
RSYNC := rsync -parv
MKDIR := mkdir -p
RM := rm -rfv
LSH := ls -larth
CP := cp -rv
MV := mv
CAT := `which cat`
SED := `which sed`
LS := ls -l@k

ZIP := zip -r -v

DEBUGFLAGS := --list --c-code-in-asm

POSIX_DIR ?= ./BUILD-posix
POSIX_CC ?= cc
POSIX_CFLAGS ?= -O2 -Wall -Wno-pointer-sign
POSIX_SRC := nbnget.c ../common/nbn.c ../common/net_posix.c ../common/posix.c
POSIX_GEN := $(POSIX_DIR)/messages.c $(POSIX_DIR)/help.c

all: binaries

clean:
	$(RM) $(BUILD_DIR)
	$(RM) $(NAME).map
	$(RM) $(NAME)_CODE.bin
	$(RM) $(NAME)_MAIN.bin
	$(RM) $(NAME)_UNASSIGNED.bin
	$(RM) $(POSIX_DIR)

dirs:
	$(MKDIR) $(BUILD_DIR)

dotn:
	$(CC) $(CCFLAGS) $(LDFLAGS) @nbnget.lst -o$(NAME) -create-app -subtype=dotn
	$(MV) $(NAME) $(BUILD_DIR)/$(NAME)

binaries: dirs dotn

posix: $(POSIX_DIR)/$(NAME)

$(POSIX_DIR)/$(NAME): $(POSIX_SRC) $(POSIX_GEN) ../common/*.h help.h
	$(POSIX_CC) $(POSIX_CFLAGS) -o $@ $(POSIX_SRC) $(POSIX_GEN)

$(POSIX_DIR)/messages.c: ../common/messages.asm ../common/messages2c.awk
	$(MKDIR) $(POSIX_DIR)
	awk -f ../common/messages2c.awk ../common/messages.asm > $@

# The same files help.asm includes with BINARY
$(POSIX_DIR)/help.c: help.txt ../../VERSION CREDITS
	$(MKDIR) $(POSIX_DIR)
	( for f in help:help.txt version:../../VERSION credits:CREDITS; do \
		echo "unsigned char $${f%%:*}[] = {"; xxd -i < $${f#*:}; echo ", 0 };"; \
	done ) > $@

install:
	$(CP) $(BUILD_DIR)/$(NAME) $(INSTALL_DRIVE)/dot

q: dotn install

deploy: all install
