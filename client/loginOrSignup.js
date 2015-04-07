PERMISSIVE = true;

function xxxsetSessionDefaults()
  {
  Session.setDefault("bitcoinEmailSpamAutopayAmount",100);
  Session.setDefault("bitcoinEmailSendTipAmount",5000);
  Session.setDefault("emailSendTipDuration",60*24*7);  // 7 days in minutes  
  }

function xxxsetSessionLocals(dataObj)
  {
  Session.set("bitcoinEmailSpamAutopayAmount",dataObj.bitcoinEmailSpamAutopayAmount);
  Session.set("bitcoinEmailSendTipAmount",dataObj.bitcoinEmailSendTipAmount);
  Session.set("emailSendTipDuration",dataObj.emailSendTipDuration);
  }

function login(username,password)
  {
      // The locally cached copy will be keyed off of a hash of the username
      var userRecordHandle = sjcl.codec.base64.fromBits(sjcl.hash.sha256.hash(username));
      // and will be encrypted with this password
      var userRecDataKey = sjcl.codec.base64.fromBits(sjcl.hash.sha256.hash(username + ":" + password + ":" + SALT));

      //loginoutCleanup();
      //setSessionDefaults();
      globals.username = username;
      globals.password = password;
      globals.userRecordHandle = userRecordHandle;
      globals.serverPassword = createServerPassword(username, password);
      //Session.set("username", username);  // We may need this later to receive normal email
      //Session.set("password", password);  // We may need this later to receive normal email
      //Session.set("recHandle", userRecordHandle);
      //var serverPassword = createServerPassword(username, password);
      //Session.set("serverPassword",serverPassword);

      var encdata = localStorage.getItem(userRecordHandle);

      // debugging: Set this to null here to force load from server: encdata = null;
      if ((encdata == null)||(encdata=="null")) // No local data.  We will check the server for this user
        {
        console.log("ask the server");
        Meteor.call("userLogin",globals.username,globals.serverPassword,function (error,result) { if (error) DisplayError(error); else loginGood(userRecDataKey,result); });
        return;
        }
      else
        {
        console.log("using locally stored data");
        Meteor.call("clientUserLogin",globals.username,globals.serverPassword,
          function (error,result) 
            { 
            if (error) DisplayError(error);
            else if (result) loginGood(userRecDataKey,encdata);
            else DisplayError("Bad login");
          });
        return;
        }

      
  }

function loginGood(userRecDataKey,encdata)
{
    console.log("login ok");
    if (encdata == null)  // Bad login
    {
        //console.log("oh no");
        Session.set("userData", null);
        DisplayError("Unknown username or incorrect password.");
    }
    else  // username successful
    {
        //console.log("data is: ", encdata);
        try
        {
          var data = sjcl.decrypt(userRecDataKey, encdata);
        }
        catch(e)
        {
          DisplayError("Unknown username or incorrect password.");
        }
        //console.log("decrypted is: ", data);
        try 
        { 
            var dataObj = JSON.parse(data);
            Session.set("userData",dataObj);
            //ClearError();

            // Ok we logged in.  So head to the appropriate page
            if (profileNeedsWork()) 
              { 
              ShowProfilePage(dataObj);
              }
            else SetPage("main");
            Session.set("loggedIn",true);
            hide("signup");
        }
        catch(e)  // JSON parsing issue
        {
            // TODO: get data from server in case local corruption
            DisplayError("Unknown username or incorrect password.");
        }
    }
}


  Template.login.events({
    "click #siteIntroIcon": function (event)
      {
      toggle("siteIntro");
      },
    "click #username": function ()
      {
      
      },
    "click #password": function ()
      {
      },
    "click #signup": function ()
      {
      show("signup");
      },
    "click #login": function ()
      {
      console.log("login");
      // Grab the username/password from the text boxes on screen
      var username = document.getElementById('username').value;
      var password = document.getElementById('password').value;
      login(username,password);
      }
});


function ith(num)
  {
  if (num == 1) return "1st";
  if (num == 2) return "2nd";
  if (num == 3) return "3rd";
  else return "" + num + "th";
  }

Template.signupPage.helpers({
  serverDNSname: DNSname,
  });

Template.signupPage.events({
   "keyup #signup_username": function(event) 
  {
  var name = event.target.value;
  //var name = document.getElementById('signup_username').value;
  if (name)
    {
    Meteor.call("checkUsernameAvailability",name, function(error, result)
      {
      if (error == null)
        {
        if (!result[1]) 
          {
          Session.set("usernameValidity",name + "@" + DNSname + " is " + result[0]);
          Session.set("usernameAccepted", false);
          }
        else 
          {
          Session.set("usernameValidity",name + "@" + DNSname + " is available");
          Session.set("usernameAccepted", true);
          }
        }
      else
        {
        Session.set("usernameValidity","Cannot contact server, try later");
        }
      });
    }
  else
    {
    Session.set("usernameValidity",name + "@" + DNSname + " is invalid");
    }
  //console.log(Template.signupPage.helpers.usernameValidity);
  },
  "keyup #signup_password": function(event) 
  {
  var pw = event.target.value;
  if ((pw == null)||(pw==""))
    {
    Session.set("passwordValidity", "");
    Session.set("passwordAccepted", false);
    return;
    }
  if (Session.get("usernameAccepted"))
    {
    var un = document.getElementById('signup_username').value;
    if (pw.search(un) != -1)
      {
      Session.set("passwordValidity", "Seriously!?? You put your username in your password and you think that that's going to stay secret?");
      Session.set("passwordAccepted", false);
      return;
      }
    }
  var common = passwords.indexOf(pw);
  if (common != -1)
    {
    Session.set("passwordValidity", "Congratulations!  You picked the " + ith(common) + " most common password!");
    Session.set("passwordAccepted", false);
    return;    
    }
  if (pw.length < 8)
    {
    Session.set("passwordValidity", "A hacker will brute force this in about " + Math.pow(64,pw.length)/2 + " tries.");
    Session.set("passwordAccepted", false);
    return;
    }


  Session.set("passwordAccepted", true);
  Session.set("passwordValidity","");
  },


  "click #signupjoin": function()
  {
    if (!Session.get("passwordAccepted") || !Session.get("usernameAccepted"))
      {
      if (!PERMISSIVE)
        {
        DisplayError("Invalid username or password");
        return;
        }
      else
        {
        DisplayWarning("You username or password has issues.  Don't say I didn't warn you...");
        }
      }
    
  console.log("JOIN");
  var username = document.getElementById('signup_username').value;
  var password = document.getElementById('signup_password').value;

  // Retry if bad password
  if (isStupidPassword(password)) { DisplayError("That is a TERRIBLE password!  Pick another..."); return; }

  var serverPassword = createServerPassword(username, password);

  // Make a user data record
  var userdata = new UserData();
  userdata.name = username;
  userdata.btcWalletSeed = sjcl.random.randomWords(8);

  var encdata = storeLocalUserData(userdata, username, password);

  // Store the user data on the server, at the same time checking to make sure it worked
  Meteor.call("createUser",username, serverPassword, encdata, function(error, result) 
    {
    if (error) 
      {
      DisplayError("Server connection error."); 
      return;
      }
    else if (result == false) 
      { 
      DisplayError("Somebody beat you to it!  Try again."); 
      deleteLocalUserData(username);   
      return; 
      }
    else login(username,password);
    }
  );

 
  },
});
