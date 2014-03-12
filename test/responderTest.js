"use strict";

var expect  = require("chai").expect;
var path    = require("path");
var request = require("request");
var Q       = require("q");

var Robot       = require("hubot/src/robot");
var TextMessage = require("hubot/src/message").TextMessage;

describe("Sonos listener", function() {
    var robot;
    var user;
    var adapter;
    var robotHttpPort;

    function postData(payload, done) {
        request(
            {
                url: "http://localhost:" + robotHttpPort + "/hubot/sonos",
                method: "POST",
                json: payload,
            },
            function (err, resp) {
                // console.log(err, resp, body);
                if (resp) {
                    // console.log(resp.statusCode);
                }
                
                if (err) {
                    console.log("error publishing");
                    
                    done(err);
                }
                
                done();
            }
        );
    }

    beforeEach(function(done) {
        var connectedDeferred = Q.defer();
        var listeningDeferred = Q.defer();
        
        // create new robot, without http, using the mock adapter
        process.env.PORT = 0;
        robot = new Robot(null, "mock-adapter", true, "Eddie");

        robot.adapter.on("connected", function() {
            // only load scripts we absolutely need, like auth.coffee
            process.env.HUBOT_AUTH_ADMIN = "1";
            
            robot.loadFile(
                path.resolve(
                    path.join("node_modules/hubot/src/scripts")
                ),
                "auth.coffee"
            );

            // load the module under test and configure it for the
            // robot.  This is in place of external-scripts
            require("../index")(robot);

            // create a user
            user = robot.brain.userForId("1", {
                name: "mocha",
                room: "#mocha"
            });

            adapter = robot.adapter;
            
            connectedDeferred.resolve();
        });
        
        robot.server.on("listening", function() {
            robotHttpPort = robot.server.address().port;
            
            listeningDeferred.resolve();
        });

        robot.run();
        
        Q
            .all([connectedDeferred.promise, listeningDeferred.promise])
            .then(function() {
                done();
            });
    });

    afterEach(function(done) {
        robot.shutdown();
        
        // robot doesn't shut down the http server
        robot.server.close(done);
    });

    it("responds when greeted", function(done) {
        // here's where the magic happens!
        adapter.on("send", function(envelope, strings) {
            expect(strings[0]).match(/Why hello there/);

            done();
        });

        adapter.receive(new TextMessage(user, "Computer!"));
    });

    it("is reasonable when no data received", function(done) {
        adapter.on("send", function(envelope, strings) {
            expect(strings[0]).match(/I have no idea/);

            done();
        });

        adapter.receive(new TextMessage(user, "Eddie: what's playing in boston?"));
    });

    it("returns the current track when playing", function(done) {
        postData({
            event: "transport-state",
            location: "Boston",
            room: "Middle of Office",
            body: {
                room: "Middle of Office",
                zoneState: "PLAYING",
                trackNo: 1,
                currentTrack: {
                    title: "Orion (Instrumental)",
                    artist: "Metallica",
                    album: "Master Of Puppets"
                },
                "nextTrack": {
                    title: "Pompeii",
                    artist: "Bastille",
                    album: "Bad Blood"
                }
            }
        }, function() {
            adapter.receive(new TextMessage(user, "Eddie: what's playing in boston?"));
        });
        
        adapter.on("send", function(envelope, strings) {
            expect(strings[0]).match(/Orion/);

            done();
        });
    });

    it("ignores first player update if state is not playing", function(done) {
        postData({
            event: "transport-state",
            location: "Boston",
            room: "Middle of Office",
            body: {
                room: "Middle of Office",
                zoneState: "STOPPED",
                trackNo: 1,
                currentTrack: {
                    title: "Orion (Instrumental)",
                    artist: "Metallica",
                    album: "Master Of Puppets"
                },
                "nextTrack": {
                    title: "Pompeii",
                    artist: "Bastille",
                    album: "Bad Blood"
                }
            }
        }, function() {
            adapter.receive(new TextMessage(user, "Eddie: what's playing in boston?"));
        });
        
        adapter.on("send", function(envelope, strings) {
            expect(strings[0]).match(/I have no idea/);

            done();
        });
    });
});
