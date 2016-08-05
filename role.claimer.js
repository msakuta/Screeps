
var roleClaimer = {

    /** @param {Creep} creep **/
    run: function(creep) {

        if(creep.room.name !== 'E49S13')
            creep.moveTo(new RoomPosition(25,25,'E49S13'))
        else{
            var target = creep.room.controller
            if(target && !target.my){
                if(target.level === 0){
                    if(ERR_NOT_IN_RANGE === creep.reserveController(target)){
                        creep.moveTo(target)
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
