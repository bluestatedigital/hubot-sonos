"use strict";

var util = require("util");

module.exports = function(robot) {
    var logger = robot.logger;
    
    /*
    var playerStates = {
        "boston": {                                     // location
            "Middle of Office": {                       // room
                "room": "Middle of Office",
                "zoneState": "STOPPED",
                "trackNo": 1,
                "currentTrack": {
                    "title": "Orion (Instrumental)",
                    "artist": "Metallica",
                    "album": "Master Of Puppets"
                },
                "nextTrack": {
                    "title": "Pompeii",
                    "artist": "Bastille",
                    "album": "Bad Blood"
                }
            }
        }
    };
    */
    
    var playerStates = {};
    
    robot.router.get("/hubot/sonos", function(req, resp) {
        resp.json(playerStates);
    });
    
    robot.router.post("/hubot/sonos", function(req, resp) {
        if (! req.is("json")) {
            resp.send(415);
        } else {
            logger.debug(JSON.stringify(req.body, true, 4));

            var payload = req.body;
            var location = payload.location.toLowerCase();
            
            logger.info("got %s event for %s", payload.event, location);
            
            if (payload.event === "transport-state" && payload.body.zoneState === "PLAYING") {
                if (! (location in playerStates)) {
                    playerStates[location] = {};
                }
                
                playerStates[location][payload.room] = payload.body;
            }

            resp.send(204); // no content
        }
    });
    
    robot.hear(/Computer!/, function(msg) {
        msg.send("Why hello there! (ticker tape, ticker tape)");
    });
    
    robot.respond(/(what's|what is) playing in (\w+\s*)+\??/, function(msg) {
        var location = msg.match[2].toLowerCase();
        
        var players = playerStates[location];
        
        if (! players) {
            logger.warning("no players");
            
            msg.send("I have no idea.");
        } else {
            Object.keys(players).forEach(function(room) {
                var player = players[room];
                var currentTrack = player.currentTrack;
                
                if (player.zoneState === "PLAYING") {
                    msg.send(util.format(
                        "now playing on %s: “%s” by “%s” on “%s”",
                        room, currentTrack.title, currentTrack.artist, currentTrack.album
                    ));
                } else {
                    msg.send(util.format("%s is not playing", room));
                }
            });
        }
    });
};
