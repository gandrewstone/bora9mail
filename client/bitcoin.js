

// note, browsers can't make async requests to other domains -- well they can post but not read unless the other domain
// includes the Cross-Origin Resource Sharing (or CORS in short). It is done by including a new Access-Control-Allow-Origin HTTP header in the response.
// The symptoms are result is just "Error", with the problem being "network" and the status = 0.
// one soln is to proxy the call to the server


bitcoinFns = {
  usdPerBtc: "NA",
  usdPerBtcRefresh: function ()
  {
  //Meteor.http.get("http://winkdex.com/api/v0/price",function(result)
  Meteor.http.call("GET","https://blockchain.info/ticker?cors=true",{content: ""},function(error,result)
 // Meteor.http.get("http://api.openweathermap.org/data/2.5/weather?q=London,uk",{headers: {Accept: '/'}},function(error,result)
  {
  console.log("getting bitcoin price");
  if (result.statusCode == null)  // error
    { 
    console.log("error");
    } 
  else
    {
    console.log("content " + result.content + "data " + result.data);
    }
  })},

  //? Rebuild a Wallet object from the seed.
  constructWallet: function(seed)
    {
    var wallet = new Bitcoin.Wallet(Bitcoin.crypto.sha256(seed),Bitcoin.networks.bitcoin);
    return wallet;
    },
  ithAddr: function(wallet, idx)
    {
    var key = wallet.getPrivateKey(idx);
    var addr = key.pub.getAddress().toString();
    return [addr,key];
    },
  //? Returns the current balance in the wallet 
  getBalance: function (userData)
    {
    Session.set("btcBalance", 0.0);
    if (!userData.btcWalletSeed) 
      {
      console.log("No Wallet Seed!");
      return;
      }
    var wallet = bitcoinFns.constructWallet(userData.btcWalletSeed);
    var balance = 0;
    for (i=userData.btcWalletMinIdx; i<=userData.btcWalletIdx;i++)
      {
      var addrkey = bitcoinFns.ithAddr(wallet,i);  // returns [public key, private key]
      var btcAddr = addrkey[0];

      Meteor.call("getTxnsByAddress",btcAddr,function (error,result)
        {
        //console.log(result);
        var inputs = JSON.parse(result);

        var inputSatoshis = 0;
        var nInputs=0;
        for (var i=0;i<inputs.txs.length; i++)
        {
        for (var outi=0;outi < inputs.txs[i].out.length; outi++)
          {
          var utxo = inputs.txs[i].out[outi];
          if ((!utxo.spent) && (utxo.addr == btcAddr))
            {
            //tx.addInput(inputs.txs[i].hash, outi);
            inputSatoshis += utxo.value;
            nInputs += 1;
            }
          }
        }        
        // The outer "for" loop could do several async calls to get transactions, so multiple async instances may be summing to a total # of bits
        console.log(Session.get("btcBalance"));
        var tmp = Session.get("btcBalance");
        Session.set("btcBalance", tmp + inputSatoshis);
        }
      );
      }
    },
  depositAddress: function (userData)
    {
    if (!userData.btcWalletSeed) 
      {
      console.log("No Wallet Seed!");
      return;
      }
    var wallet = bitcoinFns.constructWallet(userData.btcWalletSeed);
    var addrkey = bitcoinFns.ithAddr(wallet,userData.btcWalletIdx);  // returns [public key, private key]
    return addrkey[0]; 
    },

  xbt2usd: function(bits) // xbt as in "bits" 1000000 per BTC
    {
    return bits*bitcoinFns.usdPerBtc/100000000;  // 100million not 1 million because usdPerBtc is defined in cents.
    },
  usd2xbt: function(usd) // xbt as in "bits" 1000000 per BTC
    {
    return usd*100000000/bitcoinFns.usdPerBtc; // 100million not 1 million because usdPerBtc is defined in cents. 
    }

  }

//bitcoinFns.usdPerBtcRefresh();

Meteor.call("usdPerBtc",function(error,result)
  {
  bitcoinFns.usdPerBtc = result;
  console.log("Received USCents per BTC exchange rate from server: " + result);
  });

// Test wallet
//key = Bitcoin.ECKey.makeRandom();
//console.log(key.toWIF());
//console.log(key.pub.getAddress().toString());
