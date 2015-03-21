//? What is the traditional email name for this server?
AppName    = "mail"
DNSname = "bora9mail.com"

SALT = "bora9";        //? appended to the password so attacker has to be specifically targetting bora9 users.
SVRSALT = "bora9svr";  //? Appended to the password when data is stored on the server so attacker has to be specifically targetting bora9 users.

MSG_ENCRYPT_CFG = {mode: "ccm", ts:64, ks:256, iter:1000 }

MSG_PREVIEW_LEN = 120;

GRAVATAR_OPTIONS = { 
     secure: true // choose between `http://www.gravatar.com` and `https://secure.gravatar.com` default is `false`
}; 

PUBLIC_KEY_PREFIX = "256a";
PUBLIC_KEY_TYPE   = "256k1";

NAMECOIN_PREFIX = "nmc:"

BALANCE_REFRESH = 30000;
