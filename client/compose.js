
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
        //GOS - this could leave a trailing ',' if the last one is a null.
        //      so lets always add the ", " and then remove the last one l8r
        //if (i < users.length -1) ret += ", ";
	    ret += ", ";
        }
    }
  return ret.slice(0,-2);  //remove the trailing ", " (or nothing if ret=="")
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
    //GOS - moved slice outside of stripHTML so end '>' of a long HTML code
    //      doesn't get lost.
    var msgPreview = stripHtml(msgtext).slice(0,MSG_PREVIEW_LEN);
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


//String ->  email address  stuff

//If the input string starts with a quoted-string, return the first position
// after the end of the quoted-string
function parseQString(str)
{
  if (str.length==0)
    return 0;
  if (str.charAt(0) != '\"')
    return 0;
  for (var i=1;i<str.len;i++)
  {
    var ch = str.charAt(i);
    if (ch == '\"')
      return ++i;
    if (ch == '\\')
      i++;  //escape character - skip next one
  }
  throw new Error('Mismatched Quote.');
}
  
//If the input string starts with an email address comment, return the position
// of the first character after the end of the comment
function parseComment(str)
{
  console.log("Checking for comments in '"+str+"'");
  if (str.length==0)
    return 0;
  if (str.charAt(0) != '(')
    return 0;
  if (str.length == 1)  //not really an error - maybe we'll do this differently l8r
    throw new Error('Mismatched Parenthesis.');
  var level = 0;
  for (var i=1;i<str.length;i++)
  {
    var ch = str.charAt(i);
    console.log("checking character " + ch);
    if (ch == '(')
    {
      level++;
      //If recursive call causes exception, just pass it up to initial calling fn.
      //i += parseComment(str.slice(i));
    }
    else if (ch == '\\') 
    {
      i++;  //escape character - skip next one
    }
    else if (ch == ')')
    {
      console.log("Closing comment level " + level);
      if (level--==0)  //First compare, then subtract after
      {
	console.log("Found " + i + " characters in a comment");
	return ++i;
      }
    }
  }
  console.log("Throwing mismatched error");
  throw new Error('Mismatched Parenthesis.');
}

//If the input string starts with an whitespace, return the position
// of the first character after the end of the whitespace
function parseWS(str)
{
  if (str.length==0)
    return 0;
  for (var i=0;(i<str.length) && (str.charAt(i)==' ' || str.charAt(i)=='\t');
       i++);
  console.log("Found " + i + " characters of whitespace");
  return i;
}

function parseDotAtom(str)
{
  var idx2=0;
  var i=0;
  console.log("Checking for dot-atom in '"+str+"'");
  do {
    idx2=0;
    if (i==str.length)
      return i;
    while (OKTEXT.indexOf(str.charAt(i + idx2)) != -1)
    {
      idx2++;
      if (i+idx2==str.length)
	return i+idx2;
    }
    i += idx2;
    //if the bad character is a '.', repeat.  Increment i to skip the
    // bad character only if we are repeating.  (i is always true (>0) when
    // idx2 is, so slipping it at the end of the while won't affect the
    // loop, but it will allow me to increment i only as needed.
  } while (idx2 && (str.charAt(i)=='.') && i++);
  return i;
} 


OKTEXT = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz" + 
          "0123456789!#$%^&*-_=+`~?/{}|'";

//Check a standard email address for syntax validity
// WS+Cmts DisplayName WS+Cmts '<' WS+Cmts Username WS+Cmts '>' WS+Cmts '@' WS+Cmts server WS+Cmts
// Username =  < addr >
// DisplayName and addr can be quoted-strings or basic text
//
// Returns [errcode,pos] where errcode is one of:
//  "Mismatch","NoClose","NoAt","NoAtom","NoServer","NoAngle", "NoFirst" or "Done"
function stdEmailAddrCheck(strg) {
  var result = ["OK",-1];  //return first illegal character and its position
  var str = strg.trim();
  var start = 0;
  var idx, idx2;
  var cnt=0, dotatom = false, requiregt = false;

  try {
    do 
    {
      cnt++;  //Which time through the outer loop = How many words
      do
      {
	idx= parseComment(str.slice(start));
	idx += parseWS(str.slice(start+idx));
	start += idx;
      } while(idx);  //parse all leading comments and whitespace
      idx2 = parseQString(str.slice(start));  //parse a quoted-string
      if (idx2==0)  //No quoted-string - parse regular text
      {
	while ((start+idx2<str.length) && 
	       (OKTEXT.indexOf(str.charAt(start+idx2)) != -1))
	{
	  idx2++;
	}
	if (idx2 && (cnt==1) && str.charAt(start+idx2) == '.')
	{
	  start += idx2+1;
	  dotatom=true;
	  break;  //In a dot-atom
	}
      }
      start+=idx2;
      if (start >= str.length)
	return ["NoAt",str.length];
    } while (idx2);  //look for another display name word
    console.log("Parsed Comments and Displayname phrase up to position "+start);
    if (str.charAt(start)=='<') {  //starting angle-addr
      requiregt = true;
      console.log("Found Angle Bracket");
      start++;
      if (start >= str.length)
	return ["NoAt",str.length];
      start+=parseWS(str.slice(start));
      start+=parseComment(str.slice(start));
      start+=parseWS(str.slice(start));
      idx2 = parseQString(str.slice(start));
      if (idx2==0)  //not a quote-string, so its a dot-atom
	dotatom = true;
      else start += idx2;
    }
    else if (!dotatom)
    {
     if (cnt>2)  //if a Displayname was parsed, '<' is required
      {
	console.log("Missing Angle bracket at position " +start);
	return ["NoAngle",start];
      }
      else if (cnt==1) //First non-comment character is not valid
      {
	console.log("Missing a user address at position " + start);
	return ["NoFirst",start];
      }
    }
    if (dotatom)  //handle dot-atom
    {
      idx = parseDotAtom(str.slice(start));
      start +=idx;
      if (start == str.length)
	return ["NoAt",start];
      if (idx==0) {
	console.log("Missing expected dot-atom at position "+ start);
	return ["NoAtom",start];
      }
    }
	
    start += parseWS(str.slice(start));
    start+=parseComment(str.slice(start));
    start+=parseWS(str.slice(start));

    //If we reached this point, we should be looking for the server part.
    console.log("Finished parsing user part at position "+ start);
  
    if (str.charAt(start) != '@') {
      console.log("Expected '@' missing at position "+start);
      return ["NoAt",start];
    }
    start++;
    start += parseWS(str.slice(start));
    start+=parseComment(str.slice(start));
    start+=parseWS(str.slice(start));
    //TODO:  if str.charAt(start)== '[', parse literal server addr.
    if ((idx = parseDotAtom(str.slice(start))) == 0)
    {
      console.log ("Server dot-atom not found at position "+start);
      return ["NoServer",start];  // a server addr is required
    }
    start += idx;
    start += parseWS(str.slice(start));
    start+=parseComment(str.slice(start));
    if (requiregt) {
      if (str.charAt(start)!='>') {
	console.log("Closing angle bracket missing at position "+start);
	return ["NoClose",start];
      }
      start++;
      start += parseWS(str.slice(start));
      start+=parseComment(str.slice(start));
    }
    //We're done, or stuck on a bad character
    return ["Done",start]
  }
  catch (e) {
    console.log(e.message);
    if (e.message.indexOf("Mismatched") != -1)
      console.log ("No string or comment close character detected");
      return ['Mismatch',str.length];
  }
}

function earlySeparator(rslt,p,str)
{
  console.log("earlySeparator, "+str.charAt(p)+", "+str);
  if (p == str.length)
    return false;
  if (str.charAt(p)==',' || str.charAt(p)==';') 
  {
    if (p==0)
    {
      console.log("Removing leading separator");
      return true;
    }
    console.log("Adding email " + str.slice(0,p));
    rslt.push(findEmail(str.slice(0,p)));
    return true;
  }
  return false;
}
    
function lateSeparator(rslt,p,str)
{
  console.log("lateSeparator");
  if (p == str.length)
    return false;
  else
  {
    console.log("Adding email " + str.slice(0,p));
    rslt.push(stdEmail(str.slice(0,p)));
    return true;
  }
  return false;
}
  
function noAction(rslt,p,str)
{
  console.log("noaction");
  return false;
}

//Actions to take while address is being typed in.  If we aren't sure, do nothing.
parseActions = {
  "Mismatch" : noAction,
  "NoClose"  : noAction,
  "NoAt" : earlySeparator,
  "NoAtom" : noAction,
  "NoFirst" : earlySeparator,
  "NoServer" : earlySeparator,
  "NoAngle" : lateSeparator,
  "Done" : lateSeparator
};

parseAddrField2 = function(toString) 
{
  var result = [];
  var parsed;
  var repeat = false;

  do {
    parsed = stdEmailAddrCheck(toString);
    console.log(parsed + "   " +toString);
    if (parseActions[parsed[0]](result,parsed[1],toString.trim()))
    {
      console.log("Result is true");
      toString = toString.slice(parsed[1]+1);
      console.log("new string: "+toString );
      repeat=(toString.length>0);
    }
    else
      console.log("Result is false");
  } while (repeat);

  return [result,toString];
}


//pareAddrField - return a 2-element array. 1st element is array of email
//  addresses.  Second is current string in INPUT HTML element.
parseAddrField = function(toString) {
  var result = []; //Array of email addresses
  var state = "INUSER";
  var level = 0;

  for (var i=0;i<toString.length;i++) {
    function splitHere() {
      console.log("Adding email " + toString.slice(0,1));
      result.push(stdEmail(toString.slice(0,i)));
      toString = toString.slice(i+1);
      i=-1;  //for loop will bump this to 0
    };

    var CommentActs = {
      '\\' : function () {i++;},
      '(': function () {level++;},
      ')': function () {
             if (level) level--;
	     else state="INUSER";
             }
    };
    var StringActs = {
      '\\' : function () {i++;},
      '\"': function () { state="INUSER"}
    };
    var UserActs = {
      '(' : function () {state="INCOMMENT"},
      '\"': function () {state="INSTRING"},
      ',': function() { splitHere();
	     console.log("Adding email " + toString.slice(0,1));
	     result.push(findEmail(toString.slice(0,i)));
	     toString = toString.slice(i+1);
	     i=-1;  //The loop will incrememnt it to 0
             },
      ';': function() {
	     console.log("Adding email " + toString.slice(0,1));
	     result.push(findEmail(toString.slice(0,i)));
	     toString = toString.slice(i+1);
	     i=-1;  //The loop will incrememnt it to 0
             },
      '@': function() {state="INDOMAIN"}
      };
    var DomainActs = {
      ',': function() {
	     console.log("D: Adding email " + toString.slice(0,1));
	     result.push(stdEmail(toString.slice(0,i)));
	     toString = toString.slice(i+1);
	     i=-1;
             },
      ';': function() {
	     console.log("D: Adding email " + toString.slice(0,1));
	     result.push(stdEmail(toString.slice(0,i)));
	     toString = toString.slice(i+1);
	     i=-1;
             },
      };
    var stateActions = {
      "INCOMMENT" : CommentActs,
      "INSTRING" : StringActs,
      "INUSER" : UserActs,
      "INDOMAIN": DomainActs
    };

    //Alternate implementation of essentially a nested switch statement
    if (typeof stateActions[state][toString.charAt(i)] == 'function') {
      stateActions[state][toString.charAt(i)]();
      }
    }
  return [result,toString];
}

function findEmail(to) {
  console.log("Looking for email for: " + to);
  if (to.slice(0,4) == PUBLIC_KEY_PREFIX)
  {
    console.log(to + " is a public key");
    return new EmailAddress("256k1","", to, to);
  }
  else if (to.slice(0,NAMECOIN_PREFIX.length) == NAMECOIN_PREFIX)
  {
    console.log(to + " is a namecoin id");
    // TODO: look this up
    return new EmailAddress("todo","",to,to);
  }
  else 
  {
    var userRec = UserRecords.findOne({username: to});
    if (userRec == null) userRec = UserRecords.findOne({name: to});
    if (userRec != null)
    {
      console.log("Found user " + userRec.username);
      if (userRec.publickey != null)
        console.log("with an encryption key");
      //TODO: change 'to' to userRec.DisplayName
      return new EmailAddress("local",to,userRec.username + "@" + DNSname,
			      userRec.publickey);
    }
    else
    {
      console.log("User " + to + " is unknown!");
      DisplayError("User " + to + " is unknown!");
      return new EmailAddress("invalid","",to,"");
    }
  }
}

function stdEmail(to) {
  if (to.search(DNSname) != -1)  // Its a local user, look up
  {
    var nameDomain = to.split("@");
    console.log(nameDomain[0] + " is a local user");
    var userRec = UserRecords.findOne({username: nameDomain[0]});
    if (userRec != null)
    {
      if (userRec.publickey != null)
        console.log("with an encryption key");
      //TODO: change nameDomain[0] to userRec.DisplayName
      return new EmailAddress("local", nameDomain[0], to, userRec.publickey);
    }
    else
    {
      DisplayError("User " + to + " is unknown!");
      return new EmailAddress("baduser", nameDomain[0], to, null);
    }
  }
  else
  {
    console.log(to + " is a RFC822 (classical) style email address");
    //TODO:  check if this address is in the address book.  if so, use address
    //       book display name.
    //TODO:  Send this to a validation routine first which will set the typ 
    //  field to either 'rfc822' or 'invalid'
    return new EmailAddress("rfc822", "", to, null );
  }
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
    var array = parseAddrField2(event.currentTarget.value);
    var tolist = Session.get("composeToUser");
    if ((tolist == undefined) || (tolist == null) || (typeof(tolist) == "string")) tolist = [,];
    tolist = tolist.concat(array[0]);
    Session.set("composeToUser",tolist);
    event.currentTarget.value = array[1];
    },
    "keyup #composeCCInput": function(event) 
    {
    var array = parseAddrField2(event.currentTarget.value);
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
       var copyToSentFolder = true;
       for (var i = 0; i < destinations.length; i++)
         {
         var to = destinations[i];
         if (to) // there can be nulls in the array
           {
           console.log("sending to " + to.address);
           var message = formatAndEncryptMessage(tos, ccs, from,rawSubject, rawMessage,null,to.publickey);
           // You can pass null into from and inreplyto to increase anonymity.
           Meteor.call("sendmail",to,from,inreplyto,message.enckey,message.subject,message.preview, message.message,message.id,copyToSentFolder,
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
	   copyToSentFolder = false;  //GOS - only store one copy
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
	{ name: 'clipboard', groups: [ 'clipboard', 'undo' ] },
	{ name: 'editing',   groups: [ 'find', 'selection', 'spellchecker' ] },
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
