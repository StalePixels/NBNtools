SECTION rodata_user

PUBLIC _help
PUBLIC _version
PUBLIC _credits

_help:
   BINARY "help.txt"
   defb 0

_version:
   BINARY "../../VERSION"
   defb 0

_credits:
   BINARY "CREDITS"
   defb 0