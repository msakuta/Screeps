module.exports = {

    /** @param {Creep} creep **/
    run: function(creep) {
        var enemy = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS)
        if(enemy){
            if(ERR_NOT_IN_RANGE === creep.rangedAttack(enemy))
                creep.moveTo(enemy)
        }
        else{
            var flag = Game.flags['ranger']
            if(flag && !flag.pos.isNearTo(creep.pos))
                creep.moveTo(flag)
            else if(!creep.memory.ready){
                creep.say('ready')
                creep.memory.ready = true
            }
        }
	}
};
