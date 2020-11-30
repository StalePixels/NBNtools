SECTION rodata_user

PUBLIC _err_invalid_option
PUBLIC _err_at_protocol
PUBLIC _err_timeout_byte
PUBLIC _err_failed_connection
PUBLIC _err_wrong_version
PUBLIC _err_nbn_protocol
PUBLIC _err_missing_filename
PUBLIC _err_transfer_error
PUBLIC _err_file_not_found
PUBLIC _err_bad_port
PUBLIC _err_bad_server

;       "+++Longest valid erro", 'r' + 0x80
_err_invalid_option:
   defm "Invalid option switc", 'h' + 0x80
_err_at_protocol:
   defm "ESP AT protocol erro", 'r' + 0x80
_err_timeout_byte:
   defm "Timeout awaiting byt", 'e' + 0x80
_err_failed_connection:
   defm "Failed to connec", 't' + 0x80
_err_wrong_version:
   defm "Wrong protocol verso", 'n' + 0x80
_err_nbn_protocol:
   defm "NBN protocol erro", 'r' + 0x80
_err_bad_port:
   defm "Invalid port number", 'r' + 0x80
_err_missing_filename:
   defm "F Missing file nam", 'e' + 0x80
_err_bad_server:
   defm "Invalid server Nam", 'e' + 0x80
_err_transfer_error:
   defm "Transfer corrup", 't' + 0x80
_err_file_not_found:
   defm "F File not foun", 'd' + 0x80