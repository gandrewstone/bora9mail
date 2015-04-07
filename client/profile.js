var findEccBackgrounder = 0;

var usdPerBtc = "NA";

function setSessionLocals(dataObj)
  {
  Session.set("bitcoinEmailSpamAutopayAmount",dataObj.bitcoinEmailSpamAutopayAmount);
  Session.set("bitcoinEmailSendTipAmount",dataObj.bitcoinEmailSendTipAmount);
  Session.set("emailSendTipDuration",dataObj.emailSendTipDuration);
  }


ShowProfilePage = function(userdata)
  {
  setSessionLocals(userdata);
  SetPage("profile");
  }

profileNeedsWork = function()
  {
  var needsWork = false;
  var userData = Session.get("userData");
  if (userData.keys.length == 0) 
    {
    DisplayWarning("You need to create an encryption key");
    needsWork = true;  // No encryption keys
    }
  // TODO: Also check balance

  return needsWork;
  }

Meteor.call("usdPerBtc",function(error,result)
  {
  usdPerBtc = result;
  console.log("received exchange from server " + result);
  });

Template.profilePage.events(
  {
  "keyup #bitcoinEmailSpamAutopayEntry": function(event)
    {
    var bits = event.currentTarget.value;
    Session.set("bitcoinEmailSpamAutopayAmount",bits);
    },
  "keyup #usdEmailSpamAutopayEntry": function(event)
    {  
    var usd = event.currentTarget.value;
    Session.set("bitcoinEmailSpamAutopayAmount",bitcoinFns.usd2xbt(usd));
    },

  "keyup #bitcoinEmailSendTipEntry": function(event)
    {
    var bits = event.currentTarget.value;
    Session.set("bitcoinEmailSendTipAmount",bits);
    },
  "keyup #usdEmailSendTipEntry": function(event)
    {  
    var usd = event.currentTarget.value;
    Session.set("bitcoinEmailSendTipAmount",bitcoinFns.usd2xbt(usd));
    },

  "keyup #emailSendTipDuration": function(event)
    {  
    var stringTime = event.currentTarget.value;
    var minutes = detimify(stringTime);
    console.log(stringTime + " " + minutes);
    if (minutes != null)
      {
      console.log ("setting");
      Session.set("emailSendTipDuration",minutes);
      }
    },

  "click #profileCancel": function() { SetPage("inbox"); },
  "click #profileCommit": function() 
    {
    var namecoinIdentity = document.getElementById('profileNamecoinIdentity').value;
    var userData = Session.get("userData");
    userData.namecoin = namecoinIdentity;
    Session.set("userData",userData);

    // TODO: encrypt and write it out.

    SetPage("inbox");
    },
  "blur #profileNamecoinIdentity, mouseout #profileNamecoinIdentity": function(event) 
     {
     var name = event.currentTarget.value;
     console.log("left namecoin box");

     Meteor.call("namecoinLookup",name,function (error, result)
       {
       if (result) 
         {
         console.log("Writing namecoin name " + name + " lookup results " + JSON.stringify(result));
         var userData = Session.get("userData");
         userData.namecoin = name;
         // Namecoin returns a string, but that string should be a JSON object for properly compliant identities
         try 
           { 
           var tmp = JSON.parse(result.value);
           result.value = tmp;
	   }
         catch(e)
           {
           // well, its not javascript... :-(
           }
         userData.namecoinData = result;
         var avatar = namecoinAvatar(result);
         console.log("avatar :" + avatar);
         if (avatar) userData.avatarUrl = avatar;
         storeLocalUserData(userData,null,null);
         }

       });
     },   
   "blur #profileGravatarIdentity, mouseout #profileGravatarIdentity": function(event) 
     {
     var data = event.currentTarget.value;
     if (!data) return;;
     var url = Gravatar.imageUrl(data, GRAVATAR_OPTIONS);
     console.log("gravatar value " + data + " image " + url);
     if (url) 
       {
       var userData = Session.get("userData");
       userData.gravatar = data;
       userData.avatarUrl = url;
       storeLocalUserData(userData,null,null);
       }
     },
   'click .genAddr': function() {
     var done = false;
     var keys = 0;
     var busy = false;
     if (findEccBackgrounder != 0) 
        {
        DisplayError("Already looking");
        return;
        }
     Session.set("keys", null);
     findEccBackgrounder = setInterval(function()
       {
       if (!busy)
         {
         var i=0;
         busy = true;
	 for (i=0;i<5;i++)  // try 5 times and then delay to let other stuff happen
	   {
	     keys = ecc.generate(ecc.ENC_DEC);
	     //console.log (keys.enc);
             if (keys.enc.substr(3,1)== "a") 
               { 
               Session.set("keys",keys); 
               clearInterval(findEccBackgrounder); 
               var userData = Session.get("userData");
               var keyData = { identifier: "", pub: keys.enc, sec: keys.dec};
               userData.keys[userData.keys.length] = keyData;
               //Session.set("userData",userData);

               storeLocalUserData(userData,null,null);

               // This sets the default public key that is returned to people who send to this user using the username@domain address.
               Meteor.call("setPublicKey",keys.enc);
               break; 
               }
           }
         }
       busy=false;
       }, 15);
   },
  });

Template.profilePage.helpers(
  {
  "emailAddress": function() { return globals.username + "@" + DNSname; },
  "namecoin": function () 
    {
    return Session.get("userData").namecoin;
    },
  "gravatar": function () { return Session.get("userData").gravatar; },
  "avatarUrl": function () { return Session.get("userData").avatarUrl; },
  "xbtBalance": function () { return (Session.get("btcBalance")/100);},
  "usdBalance": function () { return bitcoinFns.xbt2usd(Session.get("btcBalance")/100);},
  "bitcoinEmailSpamAutopayAmount": function()
    {
    return Session.get("bitcoinEmailSpamAutopayAmount");
    },
  "usdEmailSpamAutopayAmount": function()
    {
    var bits = Session.get("bitcoinEmailSpamAutopayAmount");
    return bitcoinFns.xbt2usd(bits);  
    },
  "bitcoinEmailSendTipAmount": function()
    {
    return Session.get("bitcoinEmailSendTipAmount");
    },
  "usdEmailSendTipAmount": function()
    {
    var bits = Session.get("bitcoinEmailSendTipAmount");
    return bitcoinFns.xbt2usd(bits);  
    },
  "bitcoinWalletPublicKey": function()
    {
    return bitcoinFns.depositAddress(Session.get("userData"));
    },
  "timify": function(key)
    {
    console.log(key);
    var amt = Session.get(key);
    if (amt)
      {
      return timify(amt);
      }
    return "forever";
    },
  "qrcode": function()
    {
    return "";
    },
  });

/*
=======
>>>>>>> 671182beb1443c67c30ebd24a127a32e8b3d1717
Template.profilePage.rendered = function ()
  {
    var obj = document.getElementById("publicQRcode");
    console.log("QR spot: " + obj)
    var qrcode = new QRCode(obj, { width: 128, height: 128, });
    qrcode.makeCode("bitcoin:" + bitcoinFns.depositAddress(Session.get("userData")) + "?label=" + AppName);
    return "";
  };
<<<<<<< HEAD
*/

Template.profilePage.keys = function () 
  { 
    var userData = Session.get("userData");
    var keys = userData.keys;

    //console.log(JSON.stringify(userData));
    return keys;
  }
