Messages    = new Meteor.Collection("messages");
Labels      = new Meteor.Collection("labels");
UserRecords = new Meteor.Collection("userRecords");


/*  Add in a fake message
Messages.insert({ 
            from: "foo",
            to: "bar",
            subject: "subj",
            body: "bod"
        });
*/


UserRecords.allow({
  insert: function(options) {return true; },
  remove: function(options) { return true; }
});


Messages.allow({
  insert: function(options) { return true; }
});

Labels.allow({
  insert: function(options) { return true; },
  update: function(options) { return true; }
});

createLabel = function(userid, labelname)
  {
  Labels.insert({user: userid, name: labelname, unread:0, dirty:0});
  }

labelAddMessage  = function(userid, labelname,messageId)
  {
  //var val = Labels.findOne({user:userid, name: labelname});
  //console.log("name " + val.name + " unread " + val.unread + "dirty " + val.dirty);
  var result = Labels.update({user:userid, name: labelname}, {$inc: {unread: 1, dirty: 1}});
  console.log("updated " + userid + " labelname " + labelname + " result " + result);
  var val = Labels.findOne({user:userid, name: labelname});
  console.log("name " + val.name + " unread " + val.unread + "dirty " + val.dirty);
  }


// Remote functions that clients can invoke
Meteor.methods({
    //namecoinLookup: function (name) { return "foo"; },
    clientUserLogin: function (username,password)
      {
            // Note, attacker could use this to poll random user ids and get encrypted
            // mail records.  We should not allow userId to be set unless server password is correct,
            // for those users who register a server password
            // Or maybe server never sees username, only sha256 of username
      var userRecord = UserRecords.findOne({username: username, password: password});
      if (userRecord == null) 
        {
        // TODO delay to stop brute force
        console.log("User record " + username + ":" + password + " not found");
        //throw "Record not found";
        return 0;
        }
      console.log("Found! ");
      this.setUserId(username);
      return 1;
      },
    userLogin: function (username, password) 
      {
      console.log("Attempt to log in " + username + " Password: " + password);
      var userRecord = UserRecords.findOne({username: username, password: password});
      if (userRecord == null)
        {
        // TODO delay to stop brute force
        console.log("NOPE");
        throw "Record not found";
        return null;
        }
      console.log("Found! " + userRecord.encdata );
      this.setUserId(username);
      return userRecord.encdata;
      },
    checkUser: function (username)
      {
      console.log("looking for " + username);
      if (UserRecords.findOne({username: username}) != null) 
        {
        console.log("found!");
        return true;
        }
      // TODO delay to stop phishing for usernames
      return false;
      },
    setPublicKey: function(key)
      {
      console.log("setPublicKey for: " + this.userId + " to " + key );
      UserRecords.update({name:this.userId},{$set: { publickey: key }});
      },
    createUser: function (username, password, encdata)
      {
      //if (UserRecords.findOne({name: username}) != null) return false;
      this.setUserId(username);
      UserRecords.insert({ username: username, password: password, publickey: null, encdata: encdata});
      createLabel(username, "inbox");
      createLabel(username, "drafts");
      createLabel(username, "sent");
      createLabel(username, "spam");
      createLabel(username, "deleted");
      console.log("created user " + username + " PW: " + password + " data: " + encdata);
      return true;
      },
    wipeMessages: function (options) 
      { 
      Messages.remove({}); 
      Labels.remove({});
      UserRecords.remove({});
      },

    deleteMail: function(messageIdList)
      {
      for(var i = 0; i<messageIdList.length; i++)
        {
        var msg = Messages.findOne({owner:this.userId, id: messageIdList[i]});
        if ((msg.labels.length > 1) || (msg.labels[0] != "deleted"))  // If a message has any label besides 'deleted', delete just moves the message to the 'deleted' label
          {
          console.log("moving mail: " + messageIdList[i] + " to deleted label");
          Messages.update({owner:this.userId, id: messageIdList[i]},{$set: {labels:["deleted"]}});  //GOS added $set: {}
          Labels.update({user:this.userId, name: "deleted"}, {$inc: {unread: 1}});
          }
        else 
          {
          Messages.remove({owner:this.userId,id:messageIdList[i]});  // If the message is in deleted, then really remove it.
          console.log("deleting mail: " + messageIdList[i]);
          }
        }
      return true;
      },

    createLabel: function(label)
      {
      if (!this.userId) return "Must log in first";
      createLabel(this.userId,label);
      console.log("User: " + this.userId + " Creating label:" + label);
      return "Applied";
      },
    applyLabelToMessages: function(label, messageIdList)
      {
      console.log("applyLabelToMessages");
      for(var i = 0; i<messageIdList.length; i++)
        {
        console.log("deleting mail: " + messageIdList[i]);
        Messages.update({owner: this.userId,id:messageIdList[i]},{$push: {labels:label}});
        
        }
      // TODO count the unread verses the read instead of adding the entire count
      var result = Labels.update({user:this.userId, name: label}, {$inc: {unread: messageIdList.length}});
      return true;
      },

    sendmail: function(to, from, inreplyto, enckey, subject,preview,message,id,keepcopy)
      {
      if (!this.userId) { console.log("Send but no logged in user!"); return ERROR_NOT_LOGGED_IN; }
      if (to == null) // sending to drafts
        {
        console.log("Saving draft");
        Messages.insert({ owner: this.userId, to: username, from: from, date: Date(), cipherkey: enckey, re: inreplyto, subject: subject, preview: preview, message: message, id: id, labels:["drafts"], read: false, starred: false, importance:0, });
        return;
        }

      // Normal mail send
      keepcopy = keepcopy | false;  //GOS - set a default value of false.
      console.log("sending mail to " + JSON.stringify(to) + " " + to.typ);
      if (to.typ == "local")
        {
        var username = to.address.split("@")[0];
        var rec = UserRecords.findOne({username: username});
        if (rec == null) 
          {
          // TODO, client should have eliminated this possibility.  Mark a hacker strike against sending user. 
          return false;  // Could not find the user
          }

        fromuserid = from.split("@")[0];   // From is the full address     

        console.log("sending local mail to " + username);
        // I want 2 separate copies so that sender and receiver can both delete their own copy
        Messages.insert({ owner: username,to: username, from: from, date: Date(), cipherkey: enckey, re: inreplyto, subject: subject, preview: preview, message: message, id: id, labels:["inbox"], read: false, starred: false, importance:0, });
        labelAddMessage(to.name,"inbox", id);

	if (keepcopy) {
            Messages.insert({ owner: this.userId,to: username, from: from, date: Date(), cipherkey: enckey, re: inreplyto, subject: subject, preview: preview, message: message, id: id+1, labels:["sent"], read: true, starred: false, importance:0, });
        
            labelAddMessage(fromuserid,"sent", id+1);
	    }
        }
      if (to.typ == "rfc822")
        {
        return "External Gateway not implemented!";
        }
      if (to.typ == "256k1")
        {
        return "Send to public key not implemented!";
        }
      if (to.typ == "nmc")
        {
        return "Send to namecoin registration not implemented!";
        }
      return null;
      }

});
