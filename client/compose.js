
Meteor.subscribe("userRecords");

resetCompose = function()
  {
    Session.set("composeToUser", []);
    Session.set("composeCCUser", []);  
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
        {            //  (not anymore, but the check can't hurt)
            ret += users[i].address;
        //GOS - this could leave a trailing ',' if the last address is a null.
        //      so lets always add a ", " and then remove the last one l8r
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

//Each time this is called, session variable emailAddressId is incremented
// and then returned.  The first id returned will be 5, so 0-4 can be used
// for special purposes (such as dummy objects).
function getId() 
{
  var nextId = Session.get("emailAddressId") || 4;
  Session.set("emailAddressId",++nextId);
  return nextId;
}

//typ can be 256k1, todo, local, baduser, or invalid
//tag will be appended to username portion of address after a '+' sign.
// If "", the '+' will not be added.
EmailAddress = function(typee, name,address,tag,publickey,idnum)
  {
  this.typ = typee;            //class of email address
  this.name = name;            //user display name
  this.address = address;      //address (such as user@server.com)
  this.tag = tag;              //misc info included as part of username
  this.publickey = publickey;
  this._id = idnum;
  this.testString =  function () { return "This is a test string"; };
  }  

EmailAddress.prototype.toString = function(htmlformat)
{
  htmlformat = (htmlformat==undefined) ? true : htmlformat;
  var retstr = "", tail = "";
  var lt = (htmlformat ? " &lt;" : " <");
  var gt = (htmlformat ? "&gt;" : ">");

  if ((this.typ=="local") || (this.typ == "rfc822"))
  {
    console.log("rfc822 " + this.name + " | " + this.address);
    var atpos = this.address.lastIndexOf('@');
    var uaddr = this.address.slice(0,atpos);
    if (this.name.length > 0)
    {
      retstr = this.name + lt;  //<, rendered as HTML
      tail = gt;                  //>, rendered as HTML
    }
      retstr += uaddr;
    if (this.tag.length > 0)
      retstr += '+' + this.tag;
    retstr += this.address.slice(atpos) + tail;
    console.log("rfc822 = " + retstr);
  }
  else
    retstr = this.address;
  return retstr;
};
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
      level++;
     else if (ch == '\\') 
       i++;  //escape character - skip next one
    else if (ch == ')')
    {
      //console.log("Closing comment level " + level);
      if (level--==0)  //First compare, then subtract after
      {
	//console.log("Found " + i + " characters in a comment");
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
// WS+Cmts DisplayName WS+Cmts '<' WS+Cmts Username WS+Cmts '>' WS+Cmts
//    '@' WS+Cmts server WS+Cmts
// DisplayName and Username can be quoted-strings or basic text
//
//Returns [errcode,pos] where errcode is one of:
//"Mismatch","NoClose","NoAt","NoAtom","NoServer","NoAngle", "NoFirst" or "Done"
function stdEmailAddrCheck(strg) {
  var pieces = {fullstring:strg, comments:[], displayname:"",
	       username:"", server:""};
  var names = [];
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
	if (idx)
	  pieces.comments.push(str.slice(start,start+idx));
	idx += parseWS(str.slice(start+idx));
	start += idx;
      } while(idx);  //parse all leading comments and whitespace
      idx2 = parseQString(str.slice(start));  //parse a quoted-string
      if (idx2)
	names.push(str.slice(start,start+idx));
      else  //No quoted-string - parse regular text
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
	  pieces.username = str.slice(start,start+idx2+1);
	  break;  //In a dot-atom
	}
	if (idx2)
	  names.push(str.slice(start,start+idx2));
      }
      start+=idx2;
      if (start >= str.length)
      {
	pieces.displayname = names.join(" ");
	return ["NoAt",str.length,pieces];
      }
    } while (idx2);  //look for another display name word
    console.log("Parsed Comments and Displayname phrase up to position "+start);
    if (!dotatom)
    {
      if (str.charAt(start)=='<') {  //starting angle-addr
	requiregt = true;
	console.log("Found Angle Bracket");
	start++;
	if (start >= str.length)
	  return ["NoAt",str.length];
	start+=parseWS(str.slice(start));
	do
	{
	  idx= parseComment(str.slice(start));
	  if (idx)
	    pieces.comments.push(str.slice(start,start+idx));
	  idx += parseWS(str.slice(start+idx));
	  start += idx;
	} while(idx);  //parse all comments and whitespace
	idx2 = parseQString(str.slice(start));
	if (idx2)
	{
	  pieces.username = str.slice(start,start+idx);
	  start += idx2;
	}
	else  //not a quote-string, so its a dot-atom
	  dotatom = true;
      }
      else
      {
	if (cnt>2)  //if a Displayname was parsed, '<' is required
	{
	  console.log("Missing Angle bracket at position " +start);
	  pieces.displayname = names.join(" ");
	  return ["NoAngle",start,pieces];
	}
	else if (cnt==2) //exactly one word found - set as username
	  pieces.username = names[0];
	else  //First non-comment character is not valid
	{
	  console.log("Missing a user address at position " + start);
	  return ["NoFirst",start,pieces];
	}
      }
    }
    //don't use else cuz dotatom may be set within the 'if' portion above
    if (dotatom)  //handle dot-atom
    {
      idx = parseDotAtom(str.slice(start));
      pieces.username += str.slice(start,start+idx);
      start +=idx;
      if (start == str.length)
	return ["NoAt",start,pieces];
      if (idx==0) {
	console.log("Missing expected dot-atom at position "+ start);
	return ["NoAtom",start,pieces];
      }
    }
	
    start += parseWS(str.slice(start));
    do
    {
      idx= parseComment(str.slice(start));
      if (idx)
	pieces.comments.push(str.slice(start,start+idx));
      idx += parseWS(str.slice(start+idx));
      start += idx;
    } while(idx);  //parse all comments and whitespace

    //If we reached this point, we should be looking for the server part.
    console.log("Finished parsing user part at position "+ start);
  
    if (str.charAt(start) != '@') {
      console.log("Expected '@' missing at position "+start);
      return ["NoAt",start,pieces];
    }
    start++;
    start += parseWS(str.slice(start));
    do
    {
      idx= parseComment(str.slice(start));
      if (idx)
	pieces.comments.push(str.slice(start,start+idx));
      idx += parseWS(str.slice(start+idx));
      start += idx;
    } while(idx);  //parse all comments and whitespace
    //TODO:  if str.charAt(start)== '[', parse literal server addr.
    if ((idx = parseDotAtom(str.slice(start))) == 0)
    {
      console.log ("Server dot-atom not found at position "+start);
      return ["NoServer",start,pieces];  // a server addr is required
    }
    pieces.server = str.slice(start,start+idx);
    start += idx;
    start += parseWS(str.slice(start));
    do
    {
      idx= parseComment(str.slice(start));
      if (idx)
	pieces.comments.push(str.slice(start,start+idx));
      idx += parseWS(str.slice(start+idx));
      start += idx;
    } while(idx);  //parse all comments and whitespace
    if (requiregt) {
      if (str.charAt(start)!='>') {
	console.log("Closing angle bracket missing at position "+start);
	return ["NoClose",start,pieces];
      }
      start++;
      start += parseWS(str.slice(start));
      do
      {
	idx= parseComment(str.slice(start));
	if (idx)
	  pieces.comments.push(str.slice(start,start+idx));
	idx += parseWS(str.slice(start+idx));
	start += idx;
      } while(idx);  //parse all comments and whitespace
    }
    //We're done, or stuck on a bad character
    return ["Done",start,pieces];
  }
  catch (e) {
    console.log(e.message);
    if (e.message.indexOf("Mismatched") != -1)
      console.log ("No string or comment close character detected");
      return ['Mismatch',str.length,pieces];
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
    for(var i=0;i<rslt.length;i++)
      console.log(rslt[i].toString());
    return true;
  }
  return false;
}
    
function lateSeparator(rslt,p,str,parsing)
{
  console.log("lateSeparator");
  if (p == str.length)
    return false;
  else
  {
    console.log("Adding email " + str.slice(0,p));
    rslt.push(stdEmail(parsing));
    return true;
  }
  return false;
}
  
function noAction(rslt,p,str,parsing)
{
  console.log("noaction");
  return false;
}

//Actions to take while address is typed in. If we aren't sure, do nothing.
parseActions = {
  "Mismatch" : noAction,
  "NoClose"  : noAction,
  "NoAt" : earlySeparator,
  "NoAtom" : noAction,
  "NoFirst" : earlySeparator,
  "NoServer" : earlySeparator,
  "NoAngle" : noAction,
  "Done" : lateSeparator
};

//parseAddrField - return a 2-element array. 1st element is array of email
//  addresses.  Second is current string in INPUT HTML element.
//  Set entire to true to leave nothing in the INPUT element (create an invalid
//  email address if necessary).
parseAddrField = function(toStr,entire) 
{
  var result = [];
  var parsed;
  var repeat = false;

  if (entire===undefined)
    entire=false;

  do {
    repeat=false;
    parsed = stdEmailAddrCheck(toStr);
    console.log(parsed + "   " +toStr);
    if (parseActions[parsed[0]](result,parsed[1],toStr.trim(),parsed[2]))
    {
      toStr = toStr.slice(parsed[1]+1);
      console.log("new string: "+toStr );
      repeat=(toStr.length>0);
    }
  } while (repeat);

  if (entire && toStr.length>0)  //Put everything into an email address
  {
    if (parsed[0]=="NoClose")
    {
      toStr += '>';
      parsed[0] = 'Done';
    }
    if (parsed[0] == "Done")
    {
      console.log("Adding email " + toStr);
      result.push(stdEmail(parsed[2]));
      toStr = "";
    }
    else
    {
      console.log("Adding email " + toStr);
      result.push(findEmail(toStr));
      toStr = "";
    }
  }
  return [result,toStr];
}

/*
//OLD FUNCTION
//parseAddrField - return a 2-element array. 1st element is array of email
//  addresses.  Second is current string in INPUT HTML element.
OldParseAddrField = function(toString) {
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
*/

function findEmail(to) {
  console.log("Looking for email for: " + to);
  if (to.slice(0,4) == PUBLIC_KEY_PREFIX)
  {
    console.log(to + " is a public key");
    return new EmailAddress("256k1","", to, "", to, getId());
  }
  else if (to.slice(0,NAMECOIN_PREFIX.length) == NAMECOIN_PREFIX)
  {
    console.log(to + " is a namecoin id");
    // TODO: look this up
    return new EmailAddress("todo","",to, "",to, getId());
  }
  else 
  {
    var usr = to;
    var pos;
    var tag="";
    if ((usr.charAt(0) != '"') && ((pos = usr.indexOf('+')) != -1))
    {
      tag = usr.slice(pos+1);
      usr = usr.slice(0,pos);
    }
    var userRec = UserRecords.findOne({username: usr});
    if (userRec == null) userRec = UserRecords.findOne({name: to});
    if (userRec != null)
    {
      console.log("Found user " + userRec.username);
      if (userRec.publickey != null)
        console.log("with an encryption key");
      //TODO: change 'to' to userRec.DisplayName
      return new EmailAddress("local",userRec.name || "",userRec.username + 
			      "@" + DNSname, tag, userRec.publickey, getId());
    }
    else
    {
      console.log("User " + to + " is unknown!");
      //DisplayError("User " + to + " is unknown!");
      return new EmailAddress("invalid","",to,"","", getId());
    }
  }
}

//This function should only be called after the email address is vetted
// (no illegal characters and proper format) and contains a domain part.
function stdEmail(pcs) {
  //var nameDomain = to.split("@");
  //var nameUser = nameDomain[0].split('<');
  //nameDomain = nameDomain[1].split('>');
  //console.log(nameUser);

  //Find tags in username.  If username is in quotes, then assume '+' is part
  // of name, and not a tag delimiter.
  var usr = pcs.username;
  var pos;
  var tag="";
  console.log(pcs);
  if ((usr.charAt(0) != '"') && ((pos = usr.indexOf('+')) != -1))
  {
    //console.log("+ at position "+pos);
    tag = usr.slice(pos+1);
    //console.log("Extracting Tag"+tag);
    usr = usr.slice(0,pos);
    //console.log("for user"+usr);
  }
  if (pcs.server == DNSname)  // Its a local user, look up
  {
    var userRec = null;
    if (usr)
      userRec = UserRecords.findOne({username: usr});
    if (userRec != null)
    {
      console.log(usr + " is a local user");
      if (userRec.publickey != null)
        console.log("with an encryption key");
      //TODO: change to pcs.displayname || userRec.DisplayName
      return new EmailAddress("local", pcs.displayname || userRec.name, usr +
			      '@'+ pcs.server, tag, userRec.publickey, getId());
    }
    else
    {
      DisplayError("User " + usr + " is unknown!");
      return new EmailAddress("baduser", pcs.displayname,
			      usr +'@' + pcs.server,
			      tag, null, getId());
    }
  }
  else
  {
    console.log(pcs.fullstring +" is a RFC822 (classical) style email address");
    //TODO:  check if this address is in the address book.  if so, use address
    //       book display name.
    //TODO:  Send this to a validation routine first which will set the typ 
    //  field to either 'rfc822' or 'invalid'
    return new EmailAddress("rfc822", pcs.displayname,
			    usr +'@' +pcs.server,
			    tag, null, getId());
  }
}
/*
//This function should only be called after the email address is vetted
// (no illegal characters and proper format) and contains a domain part.
function stdEmail(to) {
  var nameDomain = to.split("@");
  var nameUser = nameDomain[0].split('<');
  nameDomain = nameDomain[1].split('>');
  console.log(nameUser);
  if (nameDomain[0].search(DNSname) != -1)  // Its a local user, look up
  {
    var userRec = UserRecords.findOne({username: nameUser[nameUser.length-1]});
    if (userRec != null)
    {
     console.log(nameUser[nameUser.length-1] + " is a local user");
     if (userRec.publickey != null)
        console.log("with an encryption key");
      //TODO: change nameUser[0] to userRec.DisplayName if no angle brackets
      return new EmailAddress("local", nameUser[0],
			      nameUser[nameUser.length-1] +'@' +nameDomain[0],
			      "", userRec.publickey, getId());
    }
    else
    {
      DisplayError("User " + to + " is unknown!");
      return new EmailAddress("baduser", nameUser[0],
			      nameUser[nameUser.length-1] +'@' +nameDomain[0],
			      "", null, getId());
    }
  }
  else
  {
    console.log(to + " is a RFC822 (classical) style email address");
    //TODO:  check if this address is in the address book.  if so, use address
    //       book display name.
    //TODO:  Send this to a validation routine first which will set the typ 
    //  field to either 'rfc822' or 'invalid'
    return new EmailAddress("rfc822", nameUser[0],
			    nameUser[nameUser.length-1] +'@' +nameDomain[0],
			    "", null, getId());
  }
}
*/
/*    
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
          result[result.length] = new EmailAddress("local", nameDomain[0], to, 
						   "", userRec.publickey, 
						   getId());
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
        result[result.length] = new EmailAddress("rfc822", "", to, "", null,
						 getId());
        individuals[i] = ""; // we found this one...
        }
      }
    else if (to.slice(0,4) == PUBLIC_KEY_PREFIX)
      {
      console.log(to + " is a public key");
      result[result.length] = new EmailAddress("256k1","", to, "", to, getId());
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
          result[result.length] = new EmailAddress("local",to,userRec.username + "@" + DNSname, "", userRec.publickey, getId());
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
*/
  Template.compose.helpers(
    {
    toUser: function()
      { return Session.get("composeToUser"); },
    ccUser: function()
      { return Session.get("composeCCUser"); },
    toUserDisplay: function(name, address)
      {
      return address + ';';
      },
    toDisplay: function()
      {
	//The data context comes from Session.get, so is not the object it once
	//was.  To remake it into an object we have to create a new object and 
	//then copy the properties over.
	console.log("ToDisplay: ");
	console.log(this);
	var displ = new EmailAddress();
	for (var attr in this) {
	  displ[attr] = this[attr];
	}
	return displ.toString(true);
      },
    showCloseX: function(id)
      {
	//console.log("ShowCloseX  " + id);
	if (id == Session.get("beingWatched"))
	  return '<img class="closeX" id="'+id+'" src="closeXSmall.png"/>';
	else 
	  return "";
      }


    });

function processAddrField(str,field,entire)
{
  if (entire === undefined)
    entire = false;

  var array = parseAddrField(str,entire);
  var tolist = Session.get(field);
  if ((tolist == undefined) || (tolist == null) || (typeof(tolist) == "string"))
    tolist = [];
  tolist = tolist.concat(array[0]);
  Session.set(field,tolist);
  return array[1];
}


  Template.compose.events({
    "keyup #composeToInput": function(event) 
    {
      //If the enter key is pressed, process the whole line.  Otherwise just
      // the bits ending with separators.
      event.currentTarget.value = processAddrField(event.currentTarget.value,
	   "composeToUser",(event.keyCode == 13));

    },
    "keyup #composeCCInput": function(event) 
    {
      //If the enter key is pressed, process the whole line.  Otherwise just
      // the bits ending with separators.
      event.currentTarget.value = processAddrField(event.currentTarget.value,
	   "composeCCUser",(event.keyCode == 13));

    },
    "blur #composeToInput": function(event)
    {
      event.currentTarget.value = processAddrField(event.currentTarget.value,
						   "composeToUser",true);
    },
    "blur #composeCCInput": function(event)
    {
      event.currentTarget.value = processAddrField(event.currentTarget.value,
						   "composeCCUser",true);
    },
    'mouseenter .toAddr': function(event)
    {
      Session.set("beingWatched",event.currentTarget.id);
    },
    'mouseleave .toAddr': function(event)
    {
      //don't react to a child mouseout
      //console.log("MouseOut");
      Session.set("beingWatched",0);
      //console.log(event.currentTarget);
    },
    'click .closeX': function(event)
    {
      console.log("Close " + event.currentTarget.id);
      
      var alst = ["composeToUser","composeCCUser"];
      for (var aidx=0;aidx<alst.length;alst++)
      {
      var emlist = Session.get(alst[aidx]);
	for (var i=0;i<emlist.length;i++)
	{
	  if (emlist[i]._id == event.currentTarget.id)
	  {
	    emlist.splice(i,1);  //remove element i;
	    Session.set(alst[aidx],emlist);
	    return;
	  }
	}
      }
      console.log("ERROR: Removed email address id not found!");	
    },
    'click .toAddr': function(event)
    {
      console.log("Edit " + event.currentTarget.id);
      
      var alst = ["composeToUser","composeCCUser"];
      for (var aidx=0;aidx<alst.length;alst++)
      {
      var emlist = Session.get(alst[aidx]);
	for (var i=0;i<emlist.length;i++)
	{
	  if (emlist[i]._id == event.currentTarget.id)
	  {
	    var editaddr = new EmailAddress();
	    for (var attr in emlist[i]) {
	      editaddr[attr] = emlist[i][attr];
	    }
	    //editaddr = emlist[i];
	    //Session storage only works with strings -> doesn't keep objects
	    //let's try to restore the object-ness of this data.
	    //editaddr.prototype = EmailAddress.prototype;
	    var textfield=event.currentTarget.parentNode.querySelector(
	      ".composeInput").firstElementChild;
	    console.log(textfield);
	    console.log(editaddr);
	    console.log(editaddr.toString(false));
	    textfield.focus();
	    textfield.value=editaddr.toString(false);
	    emlist.splice(i,1);  //remove element i;
	    Session.set(alst[aidx],emlist);
	    return;
	  }
	}
      }
      console.log("ERROR: Removed email address id not found!");	
    },
    'click #composeDone': function () 
      {
       var rawMessage;
       try { rawMessage = CKEDITOR.instances.messageEditor.getData(); }
       catch(err) { rawMessage = document.getElementById('messageEditor').value; }  // oops ckeditor had a problem, used raw textbox

       //var rawTo = document.getElementById('composeToInput').value;
       var processedTo = Session.get("composeToUser");
       //var rawCC = document.getElementById('composeCCInput').value;
       var processedCC = Session.get("composeCCUser");
       var rawSubject = document.getElementById('composeSubjectInput').value;

       var from = globals.username + "@" + DNSname;
       var inreplyto = null;
       var myself = UserRecords.findOne({username: globals.username}); //Session.get("username")});

       /*var tmp = parseResolveTo(rawTo + ",");
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
*/
       var message = formatAndEncryptMessage(processedTo, processedCC, from,rawSubject, rawMessage,null,myself.publickey);
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

       //var rawTo = document.getElementById('composeToInput').value;
       var processedTo = Session.get("composeToUser");
       //var rawCC = document.getElementById('composeCCInput').value;
       var processedCC = Session.get("composeCCUser");
       var rawSubject = document.getElementById('composeSubjectInput').value;

       var from = globals.username + "@" + DNSname;
       var inreplyto = null;

       /*var tmp = parseResolveTo(rawTo + ",");
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
	 */
       var destinations = processedTo.concat(processedCC);

       //console.log("Meteor.userId():" + Meteor.userId());
       var copyToSentFolder = true;
       for (var i = 0; i < destinations.length; i++)
         {
         var to = destinations[i];
         if (to) // there can be nulls in the array
           {
           console.log("sending to " + to.address);
           var message = formatAndEncryptMessage(processedTo, processedCC, from,rawSubject, rawMessage,null,to.publickey);
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
