function setSessionDefaults()
  {
  Session.setDefault("bitcoinEmailSpamAutopayAmount",100);
  Session.setDefault("bitcoinEmailSendTipAmount",5000);
  Session.setDefault("emailSendTipDuration",60*24*7);  // 7 days in minutes  
  }

function setSessionLocals(dataObj)
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

      loginoutCleanup();
      setSessionDefaults();
      Session.set("username", username);  // We may need this later to receive normal email
      Session.set("password", password);  // We may need this later to receive normal email
      Session.set("recHandle", userRecordHandle);
      var serverPassword = createServerPassword(username, password);
      Session.set("serverPassword",serverPassword);

      var encdata = localStorage.getItem(userRecordHandle);

      // debugging: Set this to null here to force load from server: encdata = null;
      if ((encdata == null)||(encdata=="null")) // No local data.  We will check the server for this user
        {
        console.log("ask the server");
        Meteor.call("userLogin",username,serverPassword,function (error,result) { if (error) DisplayError(error); else loginGood(userRecDataKey,result); });
        return;
        }
      else
        {
        console.log("using locally stored data");
        Meteor.call("clientUserLogin",username,serverPassword,
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
            setSessionLocals(dataObj);
            ClearError();
            SetPage("main");     
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
      SetPage("siteIntro");
      },
    "click #username": function ()
      {
      
      },
    "click #password": function ()
      {
      },
    "click #signup": function ()
      {
      console.log("sign up");
      SetPage("signup");
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



Template.signupPage.helpers({
  serverDNSname: DNSname,
  usernameValidity: function () { return Session.get("usernameValidity"); }
  });

Template.signupPage.events({
   "keyup #signup_username": function() 
  {
  console.log("keypress");
  var name = document.getElementById('signup_username').value;
  if (name)
    {
    var exists = Meteor.call("checkUser",name, function(error, result)
      {
      if (error == null)
        {
        if (result) Session.set("usernameValidity",name + "@" + DNSname + " already exists");
        else Session.set("usernameValidity",name + "@" + DNSname + " is available");
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
  "click #signupjoin": function()
  {
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
    if (result == false) 
      { 
      DisplayError("Somebody beat you to it!  Try again."); 
      deleteLocalUserData(username); 
      return; 
      }
    login(username,password);
    }
  );

 

  },
});
