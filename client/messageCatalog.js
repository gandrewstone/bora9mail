
forEachDisplayedMessage = function (apply)
  {
       if (Session.get("page") == "message") // If a message is being shown, it is implicitly the selection.
         {
         var messageId = Session.get("curMessage");
         return [messageId];
         }
       // Otherwise, its the checked messages
       var elements = document.getElementById("mailListTable").getElementsByClassName("summaryCheckBox");
       var lst = [];
       for(var i = 0; i<elements.length; i++)
         {
         var elem = elements[i];
         var result = apply(elem);
         if (result)
           {
           lst[lst.length] = result;
           }
         }
    return lst;  
  }

//Run automatically when 'numCheckedEmails' changes
//Set up the list of labels of selected emails
//Set the AllEmails checkbox correctly.
Tracker.autorun(function ()
  {
    var selectnum = Session.get("numCheckedEmails");
    var elements;
    if (document.getElementById("mailListTable"))
    {
      elements = document.getElementById("mailListTable").getElementsByClassName("summaryCheckBox");
      document.getElementById("allEmails").checked = (selectnum==elements.length);
    }

    if (selectnum == 0)
    {
      Session.set("labelFullList",[]);
      Session.set("labelPartList",[]);
      return;
    }
    var mids = Tracker.nonreactive(getSelectedMessages);
    var m1 = Messages.findOne({owner: globals.username, id: mids[0]},
				{fields: {labels: 1}});
    var mlabels = m1.labels;
    if (selectnum < 2)
    {
      Session.set("labelFullList",mlabels);
      Session.set("labelPartList",[]);
      return;
    }
    var plabels = mlabels.slice(0);//copy array
    var mcursor = Messages.find({owner: globals.username, id: { $in: mids}},
				{fields: {labels: 1}});
    mcursor.forEach(function(msg,i,c) 
      {
	var alllabels = [];
	for (var i=0;i<msg.labels.length;i++)
	{
	  if (mlabels.indexOf(msg.labels[i]) != -1)
	    alllabels.push(msg.labels[i]);  //AND all label arrays
	  if (plabels.indexOf(msg.labels[i]) == -1)
	    plabels.push(msg.labels[i]);   //OR all label arrays
	}
	mlabels=alllabels;
      });
		
      Session.set("labelFullList",mlabels);
      Session.set("labelPartList",plabels);
  });
      

getSelectedMessages = function ()
  {
       if (Session.get("page") == "message") // If a message is being shown, it is implicitly the selection.
         {
         var messageId = Session.get("curMessage");
         return [messageId];
         }
       // Otherwise, its the checked messages
       var elements = document.getElementById("mailListTable").getElementsByClassName("summaryCheckBox");
       var dellst = [];
       for(var i = 0; i<elements.length; i++)
         {
         var elem = elements[i];
         if (elem.checked)
           {
           dellst[dellst.length] = elem.id;
           //console.log("deleting mail: " + elem.id);
           }
         }
    return dellst;  
  }

Template.messageCatalog.events(
  {
   'click .compose': function () 
     {
     resetCompose();
     SetPage("compose");
     },
   'click #deleteMessages': function ()
     {
       if (Session.get("page") == "message") 
         {
         SetPage("main");  // This mail is being deleted so we have to show something else
         }
       else  // If a message is being shown, it is implicitly the selection, so leave the checked emails alone.
         {
         Session.set("numCheckedEmails",0);  // We are about to delete all checked emails...
         }
       Meteor.call("deleteMail", getSelectedMessages(), function(error, result) { if (error) DisplayError("server connection error"); else DisplayWarning("Deleted"); } );
     },
   'click #applyLabel': function (event)
     {
       var mode = !Session.get("applyLabelMode");
       Session.set("applyLabelMode", mode);
       if (mode)
         {
         if (Session.get("page") == "message")  // Let's make sure there are some messages to label
           {
           DisplayHelp("Click the label you want applied to this message.");
           }
        else
           {
           var sel = getSelectedMessages();
           if (sel.length == 0) DisplayError("Select some messages before labelling them");
           DisplayHelp("Click the label you want applied to the selected messages.");
           return;
           }
         }
     }
   
  });

/*
  Template.messageCatalog.helpers({
    numSelectedEmails: function() 
    {
      // If a message is being shown, it is implicitly the selection.
      if (Session.get("page") == "message") return 1;
      return Session.get("numCheckedEmails"); 
    }
  });
*/
Template.registerHelper('numSelectedEmails', function() 
  {
    // If a message is being shown, it is implicitly the selection.
    if (Session.get("page") == "message") return 1;
    return Session.get("numCheckedEmails"); 
  });


dumpLabels = function(username)
  {
  var lbl = Labels.find({user: username }, {});
  iter.forEach(function(x) { print("name: " + x.name + " unread: " + x.unread); });
  }


Template.labelList.helpers({
  unreadcount: function ()
  {
    //var urlab = Labels.findOne({user: globals.username, parent: null, name: "unread"});
    //console.log ("Unread id is " + globals.labelIds.unread + ".  Current id is " + this._id);
    //TODO: get this to work!
    var count = Messages.find({owner: globals.username, labels: { $all: [this._id, globals.labelIds.unread]}}).count();
    if (count == 0)
      return;
    else
      return '(' + count + ')';
  },
  messageLabels: function()
    {
    //return Labels.find({user: globals.username }, {});

      //For some reason, sort and toArray are causing exceptions.  So I'm 
      // writing my own.
      var labls = Labels.find({user: globals.username, parent: null});
      var labs = labls.map(function(d) {return d;});  //toArray
      console.log("MessageLabels helper called");
      //Sort results, keeping builting labels first
      labs.sort( function(a,b) { return (a.builtin==b.builtin ? a.name.localeCompare(b.name) : (a.builtin ? -1: 1)); });
      for (var i=0;i<labs.length;i++)
      {
	//console.log(labs[i].name);
	if (labs[i].expanded == true)  //insert new labels after parent
	{
	  var ins = Labels.find({user: globals.username, parent: labs[i]._id});
	  if (ins.count() == 0) continue;
	  var insr = ins.map(function(d) {return d;});  //toArray
	  insr.sort( function(a,b) { return a.name.localeCompare(b.name); });
	  //console.log(insr[0]);
	  labs = labs.slice(0,i+1).concat(insr,labs.slice(i+1));
	}
      }
      return labs;
    },
  labelStyle: function(obj)
    {
    if (Session.get("applyLabelMode"))
      {
      return "labelPicker";
      }
    else
      {
      if (Session.get("selectedLabel") == obj._id)
        return "labelSelected";
      var ret = "labelNormal";
      if (obj.dirty>0) ret += "Dirty";
      if (obj.unread>0) ret += "Unread";
      return ret;
      }
    },
  expand: function() 
  {
    //console.log("Checking expand for " + this._id + " for " + globals.username);
    if (Labels.find({user: globals.username, parent: this._id}).count()) //At least one sub-label
    {
      if (this.expanded)
	return "unexpand.png";
      else
	return "expand.png";
    }
    else return "blank.png";
  },
  ewidth: function()
  {
    //console.log("level is " + this.level);
    return this.level * 15;
  },
  labelRename: function()
  {
    return (Session.get("renamingLabel") == this._id);
  },
  labelSelected: function()
  {
    return (Session.get("selectedLabel") == this._id);
  },
  tagbutsrc: function()
  {
    labs = Session.get("labelFullList");
    if (labs.indexOf(this._id)!= -1)
      return "fullonbutton.png";
    labs = Session.get("labelPartList");
    if (labs.indexOf(this._id)!= -1)
      return "halfonbutton.png";
    return "greybutton.png"
  }
});

Template.labelList.events({

   "click li": function(event) 
     {
     var tr = event.currentTarget;
     var id = tr.id.split(".")[1];
     // There are 2 uses for the list of labels; 
     if (Session.get("applyLabelMode")) // first adding selected emails to the label
       {
       Session.set("applyLabelMode",false);
       Meteor.call("applyLabelToMessages", id, getSelectedMessages(), function(error, result) { if (error) DisplayError("server connection error"); else DisplayWarning("Applied"); } );
       }
     else  // second showing the emails in that label.
       {
       if (Session.get("selectedLabel") == id)
	 {
	   Session.set("renamingLabel",id);
	 }
       else
         {
	   forEachDisplayedMessage(function (elem) { elem.checked = false;});
           Session.set("numCheckedEmails",0);
	   Session.set("selectedLabel", id);
	   SetPage("main");  // move the page back to the messageCatalog display
         }
       }
     },
   "click #labelAdd, click .emptyspan": function(event)
     {
       var labelname = "new label";
       var pid = event.target.id;
       var parent = null;

       if (pid.indexOf(".") == -1)
	 parent = null;
       else
	 parent = pid.split(".")[1];

       Meteor.call("createLabel", labelname, parent, function(error, newid)
		   {
		     if (error)
		       DisplayError("server connection error");
		     else
		     {
		       Session.set("renamingLabel", newid);
		       console.log ("Added label with id " + newid + " and parent: " + parent);
		     }
		   });
       event.stopPropagation();  //TODO: Make this browser-agnostic (doens't word in IE?)
     },
   "click #labelExpand": function (event)
     {
       //Label _id is part of the containing LI element's id
       id = event.target.parentElement.id.split(".")[1];
       Meteor.call("expandLabelToggle", id, function(error, result) { if (error) DisplayError("server connection error"); else DisplayWarning(result); } ); 
       event.stopPropagation();  //TODO: Make this browser-agnostic (doens't word in IE?)
     },
  "click .taggedbutton": function (event)
     {
       var fnname;
       var wlab = event.currentTarget.id.split(".")[1];
       var flist = Session.get("labelFullList");
       console.log("Clicked! " + wlab);
       if (flist.indexOf(wlab) == -1)
	 fnname = "applyLabelToMessages";
       else 
	 fnname = "clearLabelFromMessages";
       var msglist = getSelectedMessages();
       Meteor.call(fnname,wlab,msglist);
       event.stopPropagation(); 
     }
  });

Template.labelNameEdit.events({
   "keyup #labelAddInput": function(event)
    {
      var key=event.which;
      if (key==13)  // RETURN key
      {
	var newname = event.target.value;
	var labid = Session.get("renamingLabel");
        Session.set("renamingLabel","");
	ClearWarning();
	if (newname)
	{
	  console.log("ID: " + labid + " --> New name: " + newname);
	  Meteor.call("renameLabel", labid, newname, function(error, result) { if (error) DisplayError("server connection error"); else DisplayWarning(result); } );
	 }
       }
     },
   "blur #labelAddInput": function(event)
     {
       var newname = event.target.value;
       var labid = Session.get("renamingLabel");
       Session.set("renamingLabel","");
       ClearWarning();
       if (newname)
	 Meteor.call("renameLabel", labid, newname, function(error, result) { if (error) DisplayError("server connection error"); else DisplayWarning(result); } );
     },
   "focus #labelAddInput": function(event)
     {
       event.target.select();
     }
   });

  Template.labelNameEdit.rendered = function()
  {
    this.$('input').focus();
  }

  Template.messageList.helpers({
    messages: function ()
    { 
      var label = Session.get("selectedLabel");
      if (!label)
      {
	Session.set("selectedLabel", globals.labelIds.inbox); //this will trigger a redraw, so just return
	return [];
      }
      //console.log("Messages: " + label);
      //console.log("Listing: owner: " + globals.username + " label: " + label);  
      return Messages.find({owner: globals.username, labels: label}, {skip:Session.get("messageOffset"), limit: Session.get("userData").messagesPerPage });    
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


Template.messageList.events
  ({

    'mousemove .emailSummary': function(event)
      {
      var div = event.currentTarget;
      var style = div.getAttributeNode("style");
      if (style)
        {
        style.value = "color:red";
        }
      },

    'mouseout .emailSummary': function(event)
      {
      var div = event.currentTarget;
      var style = div.getAttributeNode("style");
      if (style)
        {
        style.value = "color:black";
        }

      },
    'click #allEmails': function(event)
      {
      var countArray = forEachDisplayedMessage(function (elem) { elem.checked = event.currentTarget.checked; return elem; });
      if (!event.currentTarget.checked)
        {
        Session.set("numCheckedEmails",0);
        }
      else
        {
        Session.set("numCheckedEmails",countArray.length);
        }
      event.stopPropagation();
      },
    'click .summaryCheckBox': function(event)
      {
      if (event.currentTarget.checked)
        {
        Session.set("numCheckedEmails",Session.get("numCheckedEmails")+1);        
        }
      else
        {
        Session.set("numCheckedEmails",Session.get("numCheckedEmails")-1);        
        }
      event.stopPropagation();
      },
    'click .emailSummary': function(event)
      {
        var line = event.currentTarget;
        var emailId = line.id;
        //console.log(line.id);
	forEachDisplayedMessage(function (elem) { elem.checked = false;});
        Session.set("numCheckedEmails",-1);
        Session.set("curMessage",line.id);
        SetPage("message");
	Meteor.call("clearLabelFromMessages", globals.labelIds.unread, [emailId] );
      }
  });
