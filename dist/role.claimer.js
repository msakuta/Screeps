
var flagNames = ['reserve', 'reserve2', 'claim']

var roleClaimer = {

    flagNames: flagNames,

    /** @returns {Spawn} the spawn a claimer shold start with. Can be null if no claimer is needed. */
    claimerDemands: function(){
        // Cache targeting claimers to flags
        for(let name in Game.creeps){
            let creep = Game.creeps[name]
            if(creep.memory.role === 'claimer' && creep.memory.flag){
                let flag = Game.flags[creep.memory.flag]
                if(flag)
                    flag.claimer = creep
            }
        }

        // Create claimers as the same number of uncontrolled flags
        for(let i = 0; i < flagNames.length; i++){
            let theflag = Game.flags[flagNames[i]]
            if(!theflag)
                continue

            // Cache nearest spawn by PathFinder
            if(!theflag.memory.nearestSpawn && theflag.pos){
                let goals = []
                for(let j in Game.spawns){
                    let spawn = Game.spawns[j]
                    goals.push({pos: spawn.pos, range: 1})
                }
                let bestPos = PathFinder.search(theflag.pos, goals)
                if(bestPos){
                    for(let j in Game.spawns){
                        let spawn = Game.spawns[j]
                        if(spawn.pos.isNearTo(bestPos.path[bestPos.path.length-1])){
                            theflag.memory.nearestSpawn = spawn.name
                            break
                        }
                    }
                }
            }

            if(theflag.memory.nearestSpawn && !theflag.claimer && (!theflag.room || !theflag.room.controller ||
                !theflag.room.controller.reservation || theflag.room.controller.reservation.ticksToEnd < 4500))
                return theflag.memory.nearestSpawn
        }
        return null
    },

    /** @param {Creep} creep **/
    run: function(creep) {

        if(!creep.memory.flag){
            for(let i = 0; i < flagNames.length; i++){
                let flag = Game.flags[flagNames[i]]

                if(!flag || flag.room && flag.room.controller && flag.room.controller.reservation && 4500 <= flag.room.controller.reservation.ticksToEnd)
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
                    if(Game.gcl.level === roomCount || !/claim/.test(creep.memory.flag)){
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
