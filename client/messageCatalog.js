
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

Template.messageCatalog.helpers(
  {
    numSelectedEmails: function() 
      {
      if (Session.get("page") == "message") return 1;  // If a message is being shown, it is implicitly the selection.
      return Session.get("numCheckedEmails"); 
      }
  });


dumpLabels = function(username)
  {
  var lbl = Labels.find({user: username }, {});
  
  iter.forEach(function(x) { print("name: " + x.name + " unread: " + x.unread); });
  }


Template.labelList.helpers({
  messageLabels: function()
    {
    return Labels.find({user: globals.username }, {});
    },
  labelStyle: function(obj)
    {
    if (Session.get("applyLabelMode"))
      {
      return "labelPicker";
      }
    else
      {
      if (Session.get("selectedLabel") == obj.name)
        return "labelSelected";
      var ret = "labelNormal";
      if (obj.dirty>0) ret += "Dirty";
      if (obj.unread>0) ret += "Unread";
      return ret;
      }
    }
});

Template.labelList.events({
   "click li": function(event) 
     {
     var tr = event.currentTarget;
     var name = tr.id.split(".")[1];
     // There are 2 uses for the list of labels; 
     if (Session.get("applyLabelMode")) // first adding selected emails to the label
       {
       Session.set("applyLabelMode",false);
       Meteor.call("applyLabelToMessages", name, getSelectedMessages(), function(error, result) { if (error) DisplayError("server connection error"); else DisplayWarning("Applied"); } );
       }
     else  // second showing the emails in that label.
       {
       Session.set("selectedLabel", name);
       SetPage("main");  // move the page back to the messageCatalog display
       }
     },
   "click #labelAddImg": function(event)
     {
     var val = toggle("addingLabel");
     if (val) DisplayWarning("Labels are visible to the " + AppName + " server");
     else ClearWarning();
     },
   "keyup #labelAddInput": function(event)
     {
     var key=event.which;
     if (key==13)  // RETURN key
       {
       var labelname = event.target.value;
       toggle("addingLabel");
       ClearWarning();
       Meteor.call("createLabel", labelname, function(error, result) { if (error) DisplayError("server connection error"); else DisplayWarning(result); } );
       }
     }
   });

  Template.messageList.helpers({
    messages: function ()
    { 
    var label = Session.get("selectedLabel");
    if (!label) label = "inbox";  // sanity check
    //if (label == "sent")
    //  return Messages.find({from: Session.get("username") + "@" + DNSname, labels: label}, {skip:Session.get("messageOffset"), limit: Session.get("userData").messagesPerPage }); 
    //else if (label == "drafts")
    //  return Messages.find({from: Session.get("username") + "@" + DNSname, labels: label}, {skip:Session.get("messageOffset"), limit: Session.get("userData").messagesPerPage }); 
    //else
//<<<<<<< HEAD
//    console.log("Listing: owner: " + Session.get("username") + " label: " + label);  
//    return Messages.find({owner: Session.get("username"), labels: label}, {skip:Session.get("messageOffset"), limit: Session.get("userData").messagesPerPage });
//=======
    console.log("Listing: owner: " + this.userId + "label: " + label);  
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
        console.log(line.id);
        Session.set("curMessage",line.id);
        SetPage("message");
      }
  });
