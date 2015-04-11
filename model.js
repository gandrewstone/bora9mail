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

//Returns the created label's id
createLabel = function(userid, labelname, parent, builtin)
{
  console.log( "Parent is : '" + parent +"'");
  var newid;
  if (parent)
  {
    var par = Labels.findOne({user:userid, _id: parent});
    Labels.update({user:userid, _id: parent},{$set: {expanded: true}});
    newid =  Labels.insert({user: userid, name: labelname, parent: parent,
			  level: par.level + 1, dirty:0, expanded:false, builtin: builtin});
  }
  else
    newid = Labels.insert({user: userid, name: labelname, parent: null,
			  level: 0, dirty:0, expanded:false, builtin: builtin});
  console.log ("New label id is: " + newid);
  return newid;
}

//returns number of renamed labels (should be 1 or 0)
renameLabel = function(userid, id, newname)
{
  return Labels.update({user:userid, _id: id, builtin: false},
			     {$set: {name: newname}});
}

//returns number of moved labels (should be 1 or 0)
moveLabel = function(userid, id, newparent)
{
  return Labels.update({user:userid, _id: id, builtin: false},
			     {$set: {parent: newparent}});
  //TODO: update level and childrens' levels.
}

//GOS - I don't think we need this function...
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
      if (UserRecords.findOne({username: username}) != null) return false;
      this.setUserId(username);
      UserRecords.insert({ username: username, password: password, publickey: null, encdata: encdata});
      var attid = createLabel(username, "attributes",null, true);
      var delid = createLabel(username, "deleted", null, true);
      createLabel(username, "drafts", null, true);
      createLabel(username, "inbox", null, true);
      createLabel(username, "sent", null, true);
      createLabel(username, "spam", delid, true);
      createLabel(username, "starred", attid, true);
      createLabel(username, "unread", attid, true);
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

    createLabel: function(label, pid)
      {
      if (!this.userId) return "Must log in first";
      var newid = createLabel(this.userId,label, pid, false);
      console.log("User: " + this.userId + " Creating label:" + label + " (" + newid + ")");
      return newid;
      },
    renameLabel: function(labid,labname)
      {
      if (!this.userId) return "Must log in first";
      if (renameLabel(this.userId,labid,labname))
	{
	  console.log("User " + this.userId + " renaming label " + labid + " to " + labname);
	  return "Applied";
	}
      else
	console.log("Rename of " + labid + " is not permitted");
      },
    expandLabelToggle: function(labid)
      {
	var curval = Labels.findOne({user:this.userId, _id: labid}).expanded;
	console.log("Toggle expansion of label " + labid);
	var result = Labels.update({user:this.userId, _id: labid},
			           {$set: {expanded:  !curval}});
      },
    applyLabelToMessages: function(labelId, messageIdList)
      {
      console.log("applyLabelToMessages");
      //for(var i = 0; i<messageIdList.length; i++)
      //  {
      //  console.log("deleting mail: " + messageIdList[i]);
      Messages.update({owner: this.userId,id: {$in: messageIdList}},{$push: {labels:labelId}}, {multi: true});
        
     //   }
      
      //var result = Labels.update({user:this.userId, name: label}, {$inc: {unread: messageIdList.length}});
      return true;
      },
    clearLabelFromMessages: function(labelId, messageIdList)
      {
      console.log("clearLabelFromMessages");
      return Messages.update({owner: this.userId,labels:labelId,id: {$in: messageIdList}},{$pull: {labels:labelId}}, {multi: true});
      },
    applyBuiltinLabelToMessages: function(label, messageIdList)
      {
	//label must be one of: deleted, drafts, inbox, sent, spam, unread
	//var lbl = Labels.findOne({user: this.userId,name: label,parent: null});
      console.log("applyBuiltinLabelToMessages");
      //for(var i = 0; i<messageIdList.length; i++)
      //  {
      Messages.update({owner: this.userId,id: {$in: messageIdList}},{$push: {labels:globals.labelIds[label]}}, {multi: true});
      //  }
      // TODO count the unread verses the read instead of adding the entire count
      //var result = Labels.update({user:this.userId, name: label}, {$inc: {unread: messageIdList.length}});
      return true;
      },
    clearBuiltinLabelFromMessages: function(label, messageIdList)
      {
	//label must be one of: deleted, drafts, inbox, sent, spam, unread, starred
	//var lbl = Labels.findOne({user: this.userId,name: label,parent: null});
      console.log("applyBuiltinLabelToMessages");
      //for(var i = 0; i<messageIdList.length; i++)
      //  {
      Messages.update({owner: this.userId,labels: global.labelIds[label],id: {$in: messageIdList}},{$pull: {labels:globals.labelIds[label]}}, {multi: true});
        
      //  }
      return true;
      },

    sendmail: function(to, from, inreplyto, enckey, subject,preview,message,id,keepcopy)
      {
      var d = Date.now();
      if (!this.userId) { console.log("Send but no logged in user!"); return ERROR_NOT_LOGGED_IN; }
      if (to == null) // sending to drafts
        {
        //console.log("Saving draft");
        var drlbl = Labels.findOne({user: this.userId,name: "drafts",parent: null});
        var unlbl = Labels.findOne({user: this.userId,name: "unread",parent: null});
        console.log("Saving draft to label " + drlbl.name + " (" + drlbl._id + ")");
	Messages.insert({ owner: this.userId, to: username, from: from, date: d, cipherkey: enckey, re: inreplyto, subject: subject, preview: preview, message: message, id: id, labels:[drlbl._id, unlbl._id], importance:0, });
	
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
        console.log("sending local mail to " + username + " from: " + from);
        // I want 2 separate copies so that sender and receiver can both delete their own copy
        var slbl = Labels.findOne({user: username,name: "inbox",builtin: true});
        var unlbl = Labels.findOne({user: username,name: "unread",builtin: true});
        console.log("Sending mail to label " + slbl.name + " (" + slbl._id + ")");
        Messages.insert({ owner: username,to: username, from: from, date: d, cipherkey: enckey, re: inreplyto, subject: subject, preview: preview, message: message, id: id, labels:[slbl._id, unlbl._id], importance:0, });
        labelAddMessage(username,"inbox", id);

	if (keepcopy) 
          {
            //var vlbl = Labels.findOne({user: this.userId,name: "sent",parent: null});
            console.log("Saving mail to label 'sent' (" + globals.labelIds.sent + ")");
           Messages.insert({ owner: this.userId,to: username, from: from, date: d, cipherkey: enckey, re: inreplyto, subject: subject, preview: preview, message: message, id: id+1, labels:[globals.labelIds.sent], importance:0, });      
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
