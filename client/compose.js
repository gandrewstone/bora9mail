
Meteor.subscribe("userRecords");

resetCompose = function()
  {
    Session.set("composeToUser", [,]);
    Session.set("composeCCUser", [,]);  
  }

stripHtml = function(htmltext)
  {
  //var text = $(content).text();
  var text = htmltext.replace(/(<([^>]+)>)/ig,"");
  return text;
  }

usersToString = function(users)
  {
  var ret = "";
  for (var i = 0; i<users.length; i++)
    {
      if (users[i])  // users is an array but can have some nulls
        {
        ret += users[i].address;
        if (i < users.length -1) ret += ", ";
        }
    }
  return ret;
  }

formatAndEncryptMessage = function(toUsers, ccUsers, from,subject, msgtext,signingkey,publickey)
{
    var to = usersToString(toUsers);
    var cc = usersToString(ccUsers);

    var message = { to: to, cc: cc, date: Date(),from: from, subject: subject, message: msgtext };
    var msgstr = JSON.stringify(message);
    if (signingkey)
    {
	// TODO sign msgstr, put in object, stringify
    }
    // Choose an encryption key
    var rnd = sjcl.random.randomWords(8);

    var enckey = sjcl.codec.base64.fromBits(rnd);

    // Customize the config
    var iv = sjcl.random.randomWords(8);
    var cfg = MSG_ENCRYPT_CFG;
    cfg.iv = iv;
    var encryptedMsg = sjcl.encrypt(enckey, msgstr); //,cfg,rp);
    var encryptedSubject = sjcl.encrypt(enckey, subject); //,cfg,rp);
    var msgPreview = stripHtml(msgtext.slice(0,MSG_PREVIEW_LEN));
    var encryptedPreview = sjcl.encrypt(enckey, msgPreview);
    //console.log(JSON.stringify(ct));
    //console.log(JSON.stringify(rp));
    
    // TODO ecc encryption of the key.
    if (publickey)  // Encrypt cipher key
    {
    enckey = ecc.encrypt(publickey,enckey);
    }
   
    var hash = sjcl.codec.base64.fromBits(sjcl.hash.sha256.hash(msgstr));

    return { message: encryptedMsg, subject: encryptedSubject, preview: encryptedPreview, enckey: enckey, id: hash  };
}


EmailAddress = function(typee, name,address,publickey)
  {
  this.typ = typee;
  this.name = name;
  this.address = address;
  this.publickey = publickey;
  }  


parseResolveTo = function(toString)
  {
  var result = [];
  var individuals = toString.split(",");
  for (var i = 0; i < individuals.length-1; i++) 
    {
    var to = individuals[i].trim();
    if ((to == "") || (to == null)) continue;  // skip null entries
    if (to.search("@") != -1)  // Its a classic email address: foo@bar.com
      {
      if (to.search(DNSname) != -1)  // Its a local user, look up
        {
        var nameDomain = to.split("@");
        console.log(nameDomain[0] + " is a local user");
        var userRec = UserRecords.findOne({username: nameDomain[0]});
        if (userRec != null)
          {
          if (userRec.publickey != null)
            console.log("with an encryption key");
          result[result.length] = new EmailAddress("local", nameDomain[0], to, userRec.publickey);
          individuals[i] = ""; // we found this one...
          }
        else
          {
          DisplayError("User " + to + " is unknown!");
          }
        }
      else
        {
        console.log(to + " is a RFC822 (classical) style email address");
        result[result.length] = new EmailAddress("rfc822", "", to, null );
        individuals[i] = ""; // we found this one...
        }
      }
    else if (to.slice(0,4) == PUBLIC_KEY_PREFIX)
      {
      console.log(to + " is a public key");
      result[result.length] = new EmailAddress("256k1","", to, to);
      individuals[i] = ""; // we found this one...
      }
    else if (to.slice(0,NAMECOIN_PREFIX.length) == NAMECOIN_PREFIX)
      {
      console.log(to + " is a namecoin id");
      // TODO: look this up
      result[result.length] = { type: "todo", value: to, publickey: to };
      individuals[i] = ""; // we found this one...
      }
    else 
      {
      var userRec = UserRecords.findOne({username: to});
      if (userRec == null) userRec = UserRecords.findOne({name: to});
      if (userRec != null)
          {
          if (userRec.publickey != null)
            console.log("with an encryption key");
          result[result.length] = new EmailAddress("local",to,userRec.username + "@" + DNSname, userRec.publickey);
          individuals[i] = ""; // we found this one...
          }
        else
          {
          DisplayError("User " + to + " is unknown!");
          }
      }

    }

  toString = "";
  for (var i = 0; i < individuals.length; i++) 
    {
      toString += individuals[i];
      if (i <individuals.length - 1) to += ", ";
    }

  return [result,toString];
  }

  Template.compose.helpers(
    {
    toUser: function()
      { return Session.get("composeToUser"); },
    ccUser: function()
      { return Session.get("composeCCUser"); },
    toUserDisplay: function(name, address)
      {
      return address;
      }


    });

  Template.compose.events({
    "keyup #composeToInput": function(event) 
    {
    var array = parseResolveTo(event.currentTarget.value);
    var tolist = Session.get("composeToUser");
    if ((tolist == undefined) || (tolist == null) || (typeof(tolist) == "string")) tolist = [,];
    tolist = tolist.concat(array[0]);
    Session.set("composeToUser",tolist);
    event.currentTarget.value = array[1];
    },
    "keyup #composeCCInput": function(event) 
    {
    var array = parseResolveTo(event.currentTarget.value);
    var list = Session.get("composeCCUser");
    if ((list == undefined) || (list == null) || (typeof(list) == "string")) list = [,];
    list = list.concat(array[0]);
    Session.set("composeCCUser",list);
    event.currentTarget.value = array[1];
    
    },

    'click #composeDone': function () 
      {
       var rawMessage;
       try { rawMessage = CKEDITOR.instances.messageEditor.getData(); }
       catch(err) { rawMessage = document.getElementById('messageEditor').value; }  // oops ckeditor had a problem, used raw textbox

       var rawTo = document.getElementById('composeToInput').value;
       var processedTo = Session.get("composeToUser");
       var rawCC = document.getElementById('composeCCInput').value;
       var processedCC = Session.get("composeCCUser");
       var rawSubject = document.getElementById('composeSubjectInput').value;

       var from = Session.get("username") + "@" + DNSname;
       var inreplyto = null;

       var tmp = parseResolveTo(rawTo + ",");
       var tos = processedTo.concat(tmp[0]);  // Get the last one
       if (tmp[1])
         {
         // TODO: I can't figure out one of the addresses
         }
       tmp = parseResolveTo(rawCC + ",");
       var ccs = processedCC.concat(tmp[0]);  // get the last one
       if (tmp[1])
         {
         // TODO: I can't figure out one of the addresses
         }
       myself = parseResolveTo(from + ",")[0];
       var message = formatAndEncryptMessage(tos, ccs, from,rawSubject, rawMessage,null,myself.publickey);
       // Passing null into "to", means to store in drafts, remember the full to line is stored in the encrypted msg
       Meteor.call("sendmail",null,from,inreplyto,message.enckey,message.subject,message.preview, message.message,message.id,
         function(error,result) { if (error) DisplayError("server error"); else if (result != null) DisplayError(result); });

      //Meteor.call(test,[{}]);
      // Meteor.call("createMessage",{to: "foo", subject: 'sub', body: 'RPC call'});
      //hide("compose");
      SetPage("main");
      //Session.set("composeToUser","");
      //Session.set("composeCCUser","");
      },
    'click #composeSend': function () 
      {
       var rawMessage;
       try { rawMessage = CKEDITOR.instances.messageEditor.getData(); }
       catch(err) { rawMessage = document.getElementById('messageEditor').value; }  // oops ckeditor had a problem, used raw textbox

       var rawTo = document.getElementById('composeToInput').value;
       var processedTo = Session.get("composeToUser");
       var rawCC = document.getElementById('composeCCInput').value;
       var processedCC = Session.get("composeCCUser");
       var rawSubject = document.getElementById('composeSubjectInput').value;

       var from = Session.get("username") + "@" + DNSname;
       var inreplyto = null;

       var tmp = parseResolveTo(rawTo + ",");
       var tos = processedTo.concat(tmp[0]);  // Get the last one
       if (tmp[1])
         {
         // TODO: I can't figure out one of the addresses
         }
       tmp = parseResolveTo(rawCC + ",");
       var ccs = processedCC.concat(tmp[0]);  // get the last one
       if (tmp[1])
         {
         // TODO: I can't figure out one of the addresses
         }
       var destinations = tos.concat(ccs);

       //console.log("Meteor.userId():" + Meteor.userId());

       for (var i = 0; i < destinations.length; i++)
         {
         var to = destinations[i];
         if (to) // there can be nulls in the array
           {
           console.log("sending to " + to.address);
           var message = formatAndEncryptMessage(tos, ccs, from,rawSubject, rawMessage,null,to.publickey);
           // You can pass null into from and inreplyto to increase anonymity.
           Meteor.call("sendmail",to,from,inreplyto,message.enckey,message.subject,message.preview, message.message,message.id,
             function(error,result) 
               { 
               if (error) DisplayError("server error"); 
               else if (result != null) 
                 {
                 if (result == ERROR_NOT_LOGGED_IN)
                   {
                     console.log("log in again");
                   }
                 else
                   DisplayError(result); 
                 }
               });
           }
        }
      //Meteor.call(test,[{}]);
      // Meteor.call("createMessage",{to: "foo", subject: 'sub', body: 'RPC call'});
      SetPage("main");
      //hide("compose");
      //Session.set("composeToUser","");
      //Session.set("composeCCUser","");
     },


   'click #composeCancel': function () 
     {
         //TODO:  Are you sure you want to leave without saving?
	 SetPage("main");
     }
    });

  //Template.compose.rendered = function() { $('#messageEditor').ckeditor(); };

Template.messageEditor.rendered = function ()
  {
  console.log("replace textbox with CKEDITOR");
  CKEDITOR.replace("messageEditor", {
toolbarLocation: 'bottom',
toolbarCanCollapse: true,
toolbarStartupExpanded : false,
toolbarGroups : [
    { name: 'clipboard',   groups: [ 'clipboard', 'undo' ] },
    { name: 'editing',     groups: [ 'find', 'selection', 'spellchecker' ] },
    { name: 'links' },
    { name: 'insert' },
    // { name: 'forms' },
    { name: 'tools' },
    { name: 'document',    groups: [ 'mode', 'document', 'doctools' ] },
    { name: 'others' },
    // '/',
    { name: 'basicstyles', groups: [ 'basicstyles', 'cleanup' ] },
    { name: 'paragraph',   groups: [ 'list', 'indent', 'blocks' /* , 'align' */ ] },
    { name: 'styles' },
    { name: 'colors' },
    { name: 'about' }
],
removePlugins : 'save,print,pagebreak,newpage,preview'
});

  }
