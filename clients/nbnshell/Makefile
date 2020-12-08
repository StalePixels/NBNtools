NAME ?= nbnshell
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

CRT := 5

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

all: binaries

clean:
	$(RM) $(BUILD_DIR)
	$(RM) $(NAME).map
	$(RM) $(NAME)_CODE.bin
	$(RM) $(NAME)_MAIN.bin
	$(RM) $(NAME)_UNASSIGNED.bin

dirs:
	$(MKDIR) $(BUILD_DIR)

dotn:
	$(CC) $(CCFLAGS) $(LDFLAGS) @nbnshell.lst -o$(NAME) -create-app -subtype=dotn
	$(MV) $(NAME) $(BUILD_DIR)/$(NAME)

binaries: dirs dotn

install:
	$(CP) $(BUILD_DIR)/$(NAME) $(INSTALL_DRIVE)/dot

q: dotn install

deploy: all install

watch:
	nodemon -w ../common -w . -e "c,h,asm,lst" --exec "make q||exit 1"
