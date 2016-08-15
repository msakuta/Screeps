var flagNames = ['interceptor', 'interceptor2']

function findEnemy(){
    for(var r in Game.rooms){
        var room = Game.rooms[r]
        var enemies = room.find(FIND_HOSTILE_CREEPS)
        if(0 < enemies.length)
            return room
    }
    return null
}


module.exports = {

    countSites: function(){
        var ret = 0
        for(var i = 0; i < flagNames.length; i++){
            if(flagNames[i] in Game.flags)
                ret++
        }
        return ret
    },

    findEnemy: findEnemy,

    /** @param {Creep} creep **/
    run: function(creep) {
        var enemy = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS)
        if(enemy){
            creep.say('enemy!')
            if(ERR_NOT_IN_RANGE === creep.rangedAttack(enemy) || ERR_NOT_IN_RANGE === creep.attack(enemy)){
                // Always move towards enemy for melee attack
                creep.moveTo(enemy)
            }
        }
        else{
            var enemyRoom = findEnemy()
            if(enemyRoom){
                creep.moveTo(new RoomPosition(25, 25, enemyRoom.name))
            }
            if(!creep.memory.flag){
                var flagWatchers = []

                for(let i = 0; i < flagNames.length; i++){
                    if(Game.flags[flagNames[i]])
                        flagWatchers.push({name: flagNames[i], count: 0})
                }

                // Game.creeps is game provided hash, so we don't want to iterate it
                // too many times, hence outer loop.
                for(let cname in Game.creeps){
                    c = Game.creeps[cname]
                    for(let i = 0; i < flagWatchers.length; i++){
                        let flag = Game.flags[flagWatchers[i].name]
                        if(!flag)
                            continue
                        if(c.memory.flag === flagWatchers[i].name)
                            flagWatchers[i].count++
                    }
                }

                flagWatchers.sort((a,b) => a.count - b.count)
                var flag = Game.flags[flagWatchers[0].name]
                if(flag)
                    creep.memory.flag = flag.name
            }
            else{
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
