
var roleClaimer = {

    /** @param {Creep} creep **/
    run: function(creep) {

        var roomName = Game.flags.reserve && Game.flags.reserve.room ? Game.flags.reserve.room.name : 'E48S13'

        var roomCount = _.filter(Game.rooms, r => r.controller && r.controller.my).length

        if(creep.room.name !== roomName)
            creep.moveTo(new RoomPosition(25,25,roomName))
        else{
            var target = creep.room.controller
            if(target && !target.my){
                if(target.level === 0){
                    if(Game.gcl.level === roomCount){
                        if(ERR_NOT_IN_RANGE === creep.reserveController(target)){
                            creep.moveTo(target)
                        }
                    }
                    else{
                        if(ERR_NOT_IN_RANGE === creep.claimController(target)){
                            creep.moveTo(target)
                        }
                    }
                }
            }
            else if(ERR_NOT_IN_RANGE === creep.attackController(target)){
                creep.moveTo(target)
            }
        }
    }
};

module.exports = roleClaimer;
