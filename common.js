ERROR_NOT_LOGGED_IN = 10000;


detimify = function (stringTime)
  {
  var minutes = 0;
  var amtunit = stringTime.split(" ");
  if (amtunit[1] == "hours") minutes = amtunit[0] * 60;
  if (amtunit[1] == "minutes") minutes = amtunit[0];
  if (amtunit[1] == "days") minutes = amtunit[0] * 24*60;
  return null;
  }

timify = function (minutes)
  {
  if (minutes >= 180) return "" + minutes/60 + " hours";
  if (minutes < 180) return "" + minutes + " minutes";
  if (minutes > 24*60) return "" + minutes/(24*60) + " days";
  return "" + minutes + " minutes";
  }

var stringMonth=["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

dateDisplay = function (date)
  {
  var d = date;  //Date(date);
  var n = Date.now();
  var elapsed = n - d;
  if (elapsed < 1000 * 60 * 2) // 2 minutes
    {
    return "just now";
    }
  if (elapsed < 1000 * 60 * 5) // 5 minutes
    {
    return "minutes ago";
    }
  if (elapsed < 1000 * 60 * 60)  // Less than an hour
    {
    var minutes = elapsed/(1000 * 60); 
    return "" + Math.round(minutes) + " min ago";
    }
  if (elapsed < 1000 * 60 * 60 * 24) // 1 day in milliseconds
    {
    var hours = elapsed/(1000 * 60 * 60); 
    return "" + Math.round(hours) + " hours ago";    
    }
  if (elapsed < 1000 * 60 * 60 * 24 * 7) // 7 day in milliseconds
    {
    var days = elapsed/(1000 * 60 * 60 * 24); 
    return "" + Math.round(days) + " days ago";    
    }

  return "" + stringMonth[date.getMonth()] + " " + date.getDate(); ;
  }

personDisplay = function (person)
  {
  return person;
  }

//? Create a different password that is used on the server to validate user login and return the encrypted userdata.  This password can be transmitted and stored on the server without compromising the security of the user's data because it is a different password.  Its the double SHA256 of the user's password uniquified by the user's name and a different salt then the local salt.
createServerPassword = function(username, password)
  {
  return sjcl.codec.base64.fromBits(sjcl.hash.sha256.hash(sjcl.hash.sha256.hash(username + ":" + password + ":" + SVRSALT)));
  }


//? Indicate what page should be shown
SetPage = function(pg)
    {
    Session.set("page",pg);
    }

//? Define a class that holds the user's information, if the account is device locked, this information is removed from the server.
UserData = function()
  {
  this.username = "";
  this.keys=[];
  this.namecoin = "";
  this.namecoinData = null;
  this.gravatar = "";
  this.avatarUrl = "";
  this.btcWalletSeed = null;
  this.btcWalletMinIdx  = 0;
  this.btcWalletIdx  = 0;
  this.bitcoinEmailSpamAutopayAmount = 100;
  this.bitcoinEmailSendTipAmount = 5000;
  this.emailSendTipDuration = 60*24*7;  // 7 days in minutes  
  this.messagesPerPage = 100;
  }

/*
//? This data needs to be sent to the server even if the account is device locked
UserDeviceSyncingData = function()
  {
  this.labels = { "inbox": {count:0}, "sent": { count:0}, "drafts": {count:0},"spam": {count:0},"deleted": {count:0} };
  }
*/

isStupidPassword = function()
  {
  // TODO
  return false;
  }

deleteLocalUserData = function(username)
  {
  var userRecordHandle = sjcl.codec.base64.fromBits(sjcl.hash.sha256.hash(username));
  localStorage.removeItem(userRecordHandle);
  }

storeLocalUserData = function(userdata, username, password)
  {
  if (username==null) username = globals.username; //username = Session.get("username");
  if (password==null) password = globals.password; //password = Session.get("password");  // Grab the user's password from the session if available
  var userRecDataKey = sjcl.codec.base64.fromBits(sjcl.hash.sha256.hash(username + ":" + password + ":" + SALT));
  var encdata =  sjcl.encrypt(userRecDataKey, JSON.stringify(userdata));

  // Store the user data record locally and on the server
  var userRecordHandle = sjcl.codec.base64.fromBits(sjcl.hash.sha256.hash(username));
  localStorage.setItem(userRecordHandle, encdata);
  Session.set("userData",userdata);
  return encdata;
  }
  
  var ongoingError = 0;
  //? Show an error on the screen
  DisplayError = function(errorString) 
    {
    if (ongoingError) { clearTimeout(ongoingError); ongoingError = 0; }
    Session.set("error",errorString);    
    ongoingError = setTimeout(function() { Session.set("error",""); }, 5000);
    }
  //? Clear the last error shown
  ClearError = function()
    {
    if (ongoingError) { clearTimeout(ongoingError); ongoingError = 0; }
    }

  var ongoingHelp = 0;
  //? Show an error on the screen
  DisplayHelp = function(string) 
    {
    if (ongoingHelp) { clearTimeout(ongoingHelp); ongoingHelp = 0; }
    Session.set("help",string);    
    ongoingHelp = setTimeout(function() { Session.set("help",""); }, 5000);
    }
  //? Clear the last error shown
  ClearHelp = function()
    {
    if (ongoingHelp) { clearTimeout(ongoingHelp); ongoingHelp = 0; }
    }

  var ongoingWarning = 0;
  //? Show an error on the screen
  DisplayWarning = function(string) 
    {
    if (ongoingWarning) { clearTimeout(ongoingWarning); ongoingWarning = 0; }
    Session.set("warning",string);    
    ongoingWarning = setTimeout(function() { Session.set("warning",""); }, 5000);
    }
  //? Clear the last error shown
  ClearWarning = function()
    {
    if (ongoingWarning) { clearTimeout(ongoingWarning); ongoingWarning = 0; }
    }
