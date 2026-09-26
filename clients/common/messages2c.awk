# Converts messages.asm into C strings for POSIX host builds.
# In the asm, bit 7 of the last character ends each string (the NextZXOS
# error format), so that character is written separately as 'c' + 0x80.

/^_[a-z_]+:/ { name = substr($1, 2, length($1) - 2) }

/defm/ {
    match($0, /"[^"]*"/)
    text = substr($0, RSTART + 1, RLENGTH - 2)
    match($0, /'.'/)
    last = substr($0, RSTART + 1, 1)
    printf "unsigned char %s[] = \"%s%s\";\n", name, text, last
}
