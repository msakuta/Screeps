
var flagNames = ['reserve', 'reserve2']

var roleClaimer = {

    flagNames: flagNames,

    /** @param {Creep} creep **/
    run: function(creep) {

        if(!creep.memory.flag){
            for(let i = 0; i < flagNames.length; i++){
                let flag = Game.flags[flagNames[i]]

                if(!flag)
                    continue

                if((function(){
                    for(let name in Game.creeps){
                        let creep2 = Game.creeps[name]
                        if(creep2 !== creep && creep2.memory.role === 'claimer' && creep2.memory.flag === flag.name)
                            return true
                    }
                    return false
                })())
                    continue

                creep.memory.flag = flag.name
            }
        }

        if(Game.flags[creep.memory.flag] && creep.room !== Game.flags[creep.memory.flag].room){
            creep.moveTo(Game.flags[creep.memory.flag])
        }
        else{
            var roomCount = _.filter(Game.rooms, r => r.controller && r.controller.my).length

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
