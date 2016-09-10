var flagNames = ['ranger', 'ranger2', 'ranger3', 'ranger4']

module.exports = {

    countSites: function(){
        var ret = 0
        for(var i = 0; i < flagNames.length; i++){
            if(flagNames[i] in Game.flags)
                ret++
        }
        return ret
    },

    /** @param {Creep} creep **/
    run: function(creep) {
        var enemy = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {filter: (c) => !c.owner || !(c.owner.username in Memory.allies)})
        if(enemy){
            creep.say('enemy!')
            if(ERR_NOT_IN_RANGE === creep.rangedAttack(enemy)){
                if(creep.memory.flag && Game.flags[creep.memory.flag] && Game.flags[creep.memory.flag].pos === creep.pos && creep.room.find(FIND_STRUCTURES, {filter: {structureType: STRUCTURE_RAMPART}}).length)
                    ; // Don't move if it's on a rampart (although it's not always the best strategy)
                else if(2 < creep.pos.getRangeTo(enemy))
                    creep.moveTo(enemy)
                else{
                    let path = creep.room.findPath(creep.pos, enemy.pos, {flee: true});
                    if(path.length && !enemy.pos.isEqualTo(path[path.length - 1]) ) {
                        creep.move(path[0].direction)
                    }
                }
            }
        }
        else if(!creep.memory.flag){
            var flagWatchers = []

            for(let i = 0; i < flagNames.length; i++){
                flagWatchers[i] = {name: flagNames[i], count: 0}
            }

            // Game.creeps is game provided hash, so we don't want to iterate it
            // too many times, hence outer loop.
            for(let cname in Game.creeps){
                c = Game.creeps[cname]
                for(let i = 0; i < flagNames.length; i++){
                    let flag = Game.flags[flagNames[i]]
                    if(!flag)
                        continue
                    if(c.memory.flag === flagNames[i])
                        flagWatchers[i].count++
                }
            }

            flagWatchers.sort((a,b) => a.count - b.count)
            var flag = Game.flags[flagWatchers[0].name]
            if(flag)
                creep.memory.flag = flag.name
        }
        else{
            function tryBoostKO(){
                let unboosted = false
                _.forEach(creep.body, b => {if(b.type === RANGED_ATTACK && !b.boost) unboosted = true});
                if(!unboosted)
                    return false
                let labKO = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_LAB && s.mineralType === RESOURCE_KEANIUM_OXIDE && 0 < s.mineralAmount && 0 < s.energy
                })
                if(labKO){
                    if(ERR_NOT_IN_RANGE === labKO.boostCreep(creep))
                        creep.moveTo(labKO)
                    return true
                }
                return false
            }

            if(!tryBoostKO()){
                var flag = Game.flags[creep.memory.flag]
                if(flag && !flag.pos.isEqualTo(creep.pos))
                    creep.moveTo(flag)
                else if(!creep.memory.ready){
                    creep.say('ready')
                    creep.memory.ready = true
                }
            }
        }
	}
};
