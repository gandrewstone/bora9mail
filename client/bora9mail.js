

  Meteor.startup(
    function () 
    {
    // Use the bitcoin ECC curve for the public/private key encryption just b/c its familiar.
    sjcl.ecc.curves.k1_256 = new sjcl.ecc.curve(
    sjcl.bn.pseudoMersennePrime(256, [[0,-1],[4,-1],[6,-1],[7,-1],[8,-1],[9,-1],[32,-1]]),
    "0x14551231950b75fc4402da1722fc9baee",
    0,
    7,
    "0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
    "0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8"
    );

  });

  Meteor.subscribe("inbox");
  Session.setDefault("btcBalance",0.0);
  Session.setDefault("featureCompose", false);
  Session.setDefault("messageOffset",0); // What index in the big list of messages?

  loginoutCleanup = function()
    {
        Session.set("warning","");
        Session.set("error","");
        Session.set("help","");


        Session.set("userData",null);
        Session.set("username",null);
        Session.set("recHandle",null);

	Session.set("btcBalance",0.0);
	Session.set("featurecompose", false);
	Session.set("messageOffset",0); // What index in the big list of messages?

        Session.set("composeToUser","");
        Session.set("composeCCUser","");

        Session.set("selectedLabel","inbox");
        Session.set("numCheckedEmails",0);  // count of checked emails

        Session.set("applyLabelMode",false); // mode where you are applying a label, not changing the view
        Session.set("addingLabel",false);  // Creating a new label mode
    }
  
  Tracker.autorun(function(cnxn)
    {
    var status = Meteor.status();
    if (status.connected && Session.get("cnxn" == false))
      {
      console.log("RECONNECT");
      Session.set("cnxn", true);
      }
    if (!status.connected && Session.get("cnxn" == true))
      {
      console.log("DISCONNECT");
      Session.set("cnxn", false);
      }

    });

  // Periodically refresh the current balance.  But its not important enough to do often.
  var btcBalanceRefresh = setInterval(refreshBtcBalance, BALANCE_REFRESH);

  function refreshBtcBalance()
    {
    var ud = Session.get("userData");
    if (ud) 
      { 
      bitcoinFns.getBalance(ud);
      }
    }

  Template.showUsers.users = function()
    {
    return UserRecords.find({},{});
    };

  Template.messageList.helpers({
    messages: function () { 
    //return Messages.find({to: this.userId}, {});
    //console.log(this.userId);
    return Messages.find({to: Session.get("username") }, {});
    },
    decrypt: function(key,data)
      {
      var ud = Session.get("userData");
      for(var i = 0; i<ud.keys.length; i++)
        {
        try
          {
          var realkey = ecc.decrypt(ud.keys[i].sec,key);
          }
        catch(e)
          {
          }
        try
          {
          return sjcl.decrypt(realkey,data);
          }
        catch (e)
          {
          }
        }

      // check cleartext
      try
          {
          return sjcl.decrypt(key,data);
          }
      catch (e)
          {
          }

      return "<indecipherable>";
      },
    dateDisplay: function(date) { return dateDisplay(date); },
    personDisplay: function(person) { return personDisplay(person); }
  });

Template.registerHelper("showPage",
  function(page)
      {
      return Session.get("page") == page;
      });

toggle = function(feature)
  {
  var ftr = "feature" + feature;
  var val = Session.get(ftr);
  if (val) { Session.set(ftr,0); return 0;}  // This code works if the reactive variable is undefined or null; that is, not initialized
  else { Session.set(ftr,1); return 1;}
  }

show = function(feature)
  {
  Session.set("feature" + feature, true);
  }

hide = function(feature)
  {
  Session.set("feature" + feature, false);
  }

showing = function(feature)
  {
  return Session.get("feature" + ftr);
  }

Template.registerHelper("showing",
  function(ftr)
      {
      return Session.get("feature" + ftr);
      });

Template.registerHelper("session",
  function(key)
    {
    console.log("key: " + key); 
    return Session.get(key); 
    }
  );

Template.page.helpers({
    counter: function () {
      return Session.get("counter");
    },
    loggedIn: function ()
      {
      var tmp = Session.get("userData");
      return (tmp != null);
      },
    error: function ()
      {
      var tmp = Session.get("error");
      if (tmp != null) return tmp;
      return "";
      },
    warning: function ()  
      {
      var tmp = Session.get("warning");
      if (tmp != null) return tmp;
      return "";
      },
    help: function ()
      {
      var tmp = Session.get("help");
      if (tmp != null) return tmp;
      return "";
      },
    serverStatus: function()
      {
      var status = Meteor.status();
      if (status.connected && !Session.get("cnxn"))
        {
        console.log("RECONNECT");
        Session.set("cnxn", true);
        var serverPassword = Session.get("serverPassword");
        var username = Session.get("username");
        var userdata = Session.get("userData");
        if (username && serverPassword && userdata)  // I've already logged in, just reconnect so server knows I'm here
          {
          Meteor.call("clientUserLogin",username,serverPassword, function (error,result) 
            { 
            if (error) DisplayError(error);
            //else if (result) loginGood(userRecDataKey,encdata);  // Don't need to do this on relogin
            else if (!result) DisplayError("Invalid username or password");
            });
          }
        else // data is lost I need to log in again
          {
            loginoutCleanup();
          }
        }
      if (!status.connected && Session.get("cnxn") == true)
        {
        console.log("DISCONNECT");
        Session.set("cnxn", false);
        }
      if (status.connected) { return "check.svg"; }
      return "x.svg";
      }
  });

  Template.page.events({
   "click #logout": function() {
     loginoutCleanup();

   },
   'click .clean': function () {
    var userRecordHandle = Session.get("recHandle")
    localStorage.removeItem(userRecordHandle);
    Meteor.call("wipeMessages",[]);

//var p, rp = {};  
//p = { mode: "ccm", ks: 256 }; 
//var json_sjcl = sjcl.encrypt("Secret Passphrase", "plaintext", p, rp);  
//console.log(json_sjcl);
//var plaintext = sjcl.decrypt("Secret Passphrase", json_sjcl, {}, rp);  
//console.log(plaintext);

    },
  });


Template.userInfo.events({
   "click #showProfile": function() { SetPage("profile"); },
   "mouseover #showProfile": function() { Session.set("userInfoSelected","selectedLook"); },
   "mouseout #showProfile": function() { Session.set("userInfoSelected","nothing"); }
  });

Template.userInfo.helpers({
  xbtBalance: function()
    {
    tmp = Session.get("btcBalance");
    return tmp/100;  // btcBalance is in Satoshis, return bits
    },
  username:function()
  {
  return Session.get("username") + "@" + DNSname;
  },
  avatar: function()
  {
  var userdata = Session.get("userData");
  if (userdata.avatarUrl) return userdata.avatarUrl;
  return "noavatar.svg";
  },
  publicKey:function() 
  {
/*
  var userRecord = null; //UserRecords.findOne({name: username});
  if (userRecord)
    {
    console.log("user record found");
    return userRecord.publickey;
    }
  console.log("user record not found");
*/
  return null;
  //var keys = Session.get("keys"); 
  //if (keys) return keys.enc;
  //else return ""
  },
  privateKey:function() 
  { 
  var keys = Session.get("keys"); 
  if (keys) return keys.dec;
  else return ""
  },
    
});

